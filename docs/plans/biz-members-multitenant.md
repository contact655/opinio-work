# biz-members マルチテナント設計書

**作成日**: 2026-04-28
**対象 commit**: M-4 commit 2.6 〜 5
**ステータス**: 設計確定・実装待ち

---

## 1. 背景

### 1-1. M-3 の穴が発覚

`addExistingUserToCompany()` は `ow_company_admins` にしか書かない。
しかし `getTenantContext()` / `getCompanyId()` は `ow_user_roles.role='company'` しか読まない。
→ M-3 で追加したメンバーは biz ダッシュボードにアクセスできない。

### 1-2. 設計の経緯

当初は「穴を塞ぐ = `ow_user_roles` にも書く」方針で commit 2.5 を実装した (f4bac92)。
しかし `ow_user_roles.UNIQUE(user_id, role)` の制約により、
1 ユーザーは 1 社にしか属せない構造になってしまう。

### 1-3. プロダクト方針の確定

**1 ユーザーが複数企業に属せること**を明示的に許容する。
（例: 副業・兼務・代理店スタッフが複数クライアント企業を管理する）

→ commit 2.5 (f4bac92) を revert し、マルチテナント設計に移行する。

---

## 2. 現状アーキテクチャ

### 2-1. ow_user_roles（現行の認証基盤）

```sql
CREATE TABLE ow_user_roles (
  user_id   UUID REFERENCES auth.users(id),  -- auth UUID (NOT ow_users.id)
  role      TEXT,                             -- 'company' | 'candidate' | ...
  tenant_id UUID REFERENCES ow_companies(id), -- NULLable
  UNIQUE (user_id, role)                      -- ← 1ユーザー1社の原則
);
```

`getTenantContext()` は `WHERE role='company' AND tenant_id IS NOT NULL` を読む。
→ UNIQUE 制約がある限り、1 ユーザーは 1 企業コンテキストしか持てない。

### 2-2. ow_company_admins（移行先）

```sql
CREATE TABLE ow_company_admins (
  id            UUID PRIMARY KEY,
  user_id       UUID REFERENCES ow_users(id),  -- ow_users UUID (NOT auth.users.id)
  company_id    UUID REFERENCES ow_companies(id),
  permission    TEXT,  -- 'admin' | 'member'
  is_active     BOOLEAN,
  -- migration 040 で追加した招待カラム
  invited_email       TEXT,
  invited_by_user_id  UUID,
  invitation_token    TEXT,
  invited_at          TIMESTAMPTZ,
  accepted_at         TIMESTAMPTZ
);
```

複数社に属せる設計だが、認証フローがまだ `ow_user_roles` を見ている。

### 2-3. 現行の認証フロー

```
ブラウザ → middleware (認証チェックのみ)
         → 各 API Route → getTenantContext() → ow_user_roles → company_id
```

`ow_company_admins` は **一切参照されない**。

### 2-4. company/register の二重書き

`src/app/api/company/register/route.ts:111` に以下の TODO がある:

```typescript
// TODO: ow_company_admins 移行完了後に ow_user_roles INSERT は削除予定
```

現状は ow_company_admins (permission='admin') と ow_user_roles (role='company') の両方に書いている。
**この設計書の実装が完了するまで、この二重書きは維持する。**

### 2-5. 既存データの状況

```sql
-- ow_company_admins に存在するが ow_user_roles に対応行がない 9 件
SELECT ca.id, ca.user_id, ca.company_id, ca.permission
FROM ow_company_admins ca
LEFT JOIN ow_user_roles ur
  ON ur.user_id = (SELECT auth_id FROM ow_users WHERE id = ca.user_id)
  AND ur.role = 'company'
WHERE ur.user_id IS NULL AND ca.is_active = TRUE AND ca.user_id IS NOT NULL;
-- → 9 件（すべて Shiba のシードデータ）
```

これらは UNIQUE 制約の都合でまとめて ow_user_roles に書けないシードデータ。
マルチテナント移行後は自然に解消される。

---

## 3. 設計

### G1. DB スキーマ追加（migration 042）

#### G1-1. ow_company_admins に 2 カラム追加

```sql
ALTER TABLE public.ow_company_admins
  ADD COLUMN joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN is_default  BOOLEAN     NOT NULL DEFAULT false;

-- 1 ユーザーはデフォルト企業を 1 社だけ持てる
CREATE UNIQUE INDEX uniq_default_company_per_user
  ON public.ow_company_admins (user_id)
  WHERE is_default = true AND is_active = true AND user_id IS NOT NULL;
```

**joined_at**: ow_user_roles の代替。「いつこの企業に参加したか」を記録。
**is_default**: Cookie が未設定のフォールバック先。ログイン直後に参照。

#### G1-2. 既存レコードへのデータ移行

```sql
-- is_active=true かつ user_id IS NOT NULL の全レコードに joined_at を埋める
UPDATE public.ow_company_admins
SET joined_at = COALESCE(accepted_at, invited_at, now())
WHERE is_active = true AND user_id IS NOT NULL;

-- 各 user_id ごとに最も古い参加レコードを is_default=true にする
WITH oldest AS (
  SELECT DISTINCT ON (user_id) id
  FROM public.ow_company_admins
  WHERE is_active = true AND user_id IS NOT NULL
  ORDER BY user_id, joined_at ASC
)
UPDATE public.ow_company_admins ca
SET is_default = true
FROM oldest
WHERE ca.id = oldest.id;
```

#### G1-3. ow_user_roles の扱い

**変更しない（一時的に並走）。**
company/register の二重書きは維持。
`getTenantContext()` を ow_company_admins ベースに書き換えた後、
ow_user_roles の role='company' 行は削除または放置を検討する（後続 migration で対応）。

#### G1-4. candidate ロールへの影響

candidate ロールは ow_user_roles に残す（今回のスコープ外）。
変更なし。

---

### G2. getTenantContext() の書き換え

#### G2-1. 新しい読み取りロジック

```typescript
// src/lib/business/company.ts (getCompanyId を置き換える)
export async function getTenantContext(
  supabase: SupabaseClient,
  authId: string,          // auth.users.id
  cookieCompanyId?: string // Cookie から読んだ current_company_id
): Promise<{ companyId: string; owUserId: string } | null> {

  // 1. ow_users.id を取得
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", authId)
    .maybeSingle();
  if (!owUser) return null;

  // 2. Cookie に有効な company_id があれば優先
  if (cookieCompanyId) {
    const { data: membership } = await supabase
      .from("ow_company_admins")
      .select("id")
      .eq("user_id", owUser.id)
      .eq("company_id", cookieCompanyId)
      .eq("is_active", true)
      .maybeSingle();
    if (membership) return { companyId: cookieCompanyId, owUserId: owUser.id };
    // Cookie が不正 or 退職済みなら fallback へ
  }

  // 3. is_default=true の企業を使う
  const { data: defaultMembership } = await supabase
    .from("ow_company_admins")
    .select("company_id")
    .eq("user_id", owUser.id)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (defaultMembership) return { companyId: defaultMembership.company_id, owUserId: owUser.id };

  // 4. fallback: joined_at が最も古い企業
  const { data: oldest } = await supabase
    .from("ow_company_admins")
    .select("company_id")
    .eq("user_id", owUser.id)
    .eq("is_active", true)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (oldest) return { companyId: oldest.company_id, owUserId: owUser.id };

  return null;
}
```

#### G2-2. Cookie の仕様

| 項目 | 値 |
|------|---|
| Cookie 名 | `biz_current_company_id` |
| 型 | UUID (string) |
| 有効期限 | 30日（スライディング不要） |
| SameSite | `Lax` |
| Secure | `true`（本番）/ `false`（localhost） |
| HttpOnly | `false`（JS 読み取り不要、サーバー側のみ）|

> **セキュリティ**: Cookie に company_id が入っていても、getTenantContext() は必ず
> `ow_company_admins` で所属確認する。値を改ざんしても他社のコンテキストは得られない。

#### G2-3. middleware での Cookie 読み取り

```typescript
// src/middleware.ts（認証チェック後に追記）
// current_company_id Cookie は middleware では検証しない。
// 検証は各 API Route の getTenantContext() に委ねる。
// → middleware はシンプルに保つ（認証のみ）。
```

#### G2-4. Cookie 未設定時の挙動

- 初回ログイン直後: Cookie なし → is_default=true の企業を使う
- 企業登録直後 (`/company/register`): Cookie に新企業の ID をセット、is_default=true にする
- 企業切り替え後: Cookie を更新

---

### G3. 企業切り替え UI（CompanySwitcher）

#### G3-1. 配置とデザイン

- ヘッダー左側（ロゴの隣）に現在の企業名を表示
- クリックするとドロップダウンリスト（Notion / Slack スタイル）
- 所属企業が 1 社の場合は切り替えメニューを非表示（表示は企業名のみ）

#### G3-2. API: POST /api/biz/switch-company

```typescript
// body: { company_id: string }
// 処理:
//   1. ow_company_admins で所属確認
//   2. Set-Cookie: biz_current_company_id={company_id}
//   3. { ok: true } を返す
// クライアントは router.refresh() でページを再描画
```

#### G3-3. CompanySwitcher コンポーネント

```typescript
// src/app/biz/_components/CompanySwitcher.tsx
// - 所属企業一覧を Server Component で fetch して props に渡す
// - 1社のみ: <span>{companyName}</span>（クリック不可）
// - 複数社: <button> + DropdownMenu
// - 切り替え時: POST /api/biz/switch-company → router.refresh()
```

---

### G4. accept-invite フロー（マルチテナント対応）

#### G4-1. 招待受諾後の Cookie セット

`/biz/auth/accept-invite` で招待を受諾した直後:

```typescript
// 1. ow_company_admins の accepted_at を埋め、is_active=true にする
// 2. ow_users にユーザーが存在しない場合は作成
// 3. Cookie: biz_current_company_id = 招待された company_id
// 4. is_default が未設定なら is_default=true にする
// 5. /biz/dashboard にリダイレクト
```

#### G4-2. ログイン済みユーザーのメールアドレス不一致

招待メールに含まれる `invitation_token` で受諾するとき、
すでにログイン中のユーザーのメールが `invited_email` と異なる場合:

```
「このリンクは {invited_email} 宛てに送られました。
 現在 {current_email} でログイン中です。
 このメールアドレスで参加しますか？（はい / 別のアカウントでログイン）」
```

→「はい」を選択した場合: ログイン中のユーザーを invited_email に紐付けて受諾処理を進める。
→「別のアカウントでログイン」を選択した場合: ログアウト → ログイン画面 → token を引き継ぐ。

#### G4-3. 複数企業への招待を同一ユーザーが受諾する場合

- 受諾のたびに `ow_company_admins` に行が追加される（問題なし）
- 最初に受諾した企業が `is_default=true`、2 社目以降は `is_default=false`
- Cookie は最後に受諾した企業に更新される（ユーザーは切り替え UI で戻れる）

---

## 4. Commit 計画

| Commit | 内容 | 主要ファイル |
|--------|------|------------|
| **2.6** | DB migration: joined_at + is_default + data migration + getTenantContext 書き換え | `supabase/migrations/042_multitenant_admins.sql`, `src/lib/business/company.ts` |
| **2.7** | current_company_id Cookie + /api/biz/switch-company API | `src/app/api/biz/switch-company/route.ts`, `src/middleware.ts`（最小変更） |
| **2.8** | CompanySwitcher UI + ヘッダー組み込み | `src/app/biz/_components/CompanySwitcher.tsx`, biz layout |
| **3** | accept-invite API（マルチテナント版） | `src/app/api/biz/auth/accept-invite/route.ts` |
| **4** | accept-invite ページ（G4-2 メール不一致 UI） | `src/app/biz/auth/accept-invite/page.tsx` |
| **5** | pending 表示 UI（members 管理画面） | `src/app/biz/members/page.tsx` |

---

## 5. リスク・注意点

| リスク | 対策 |
|--------|------|
| getTenantContext 書き換えで既存の /biz/company・/biz/dashboard が壊れる | commit 2.6 後に全 biz ページの動作確認を必須とする |
| is_default が 2 行以上になる（partial unique index の抜け） | migration の data migration SQL を慎重に検証。UNIQUE INDEX が張られていれば DB レベルで防止 |
| Cookie の company_id が古くなる（退職後も残留） | getTenantContext の Step 2 で所属確認し、不正 Cookie は無視して fallback へ |
| company/register の二重書きを忘れて削除してしまう | commit 2.6 では register/route.ts は変更しない。削除は後続 migration で明示的に対応 |
| ow_user_roles のデータが増殖し続ける | commit 2.6 の TODO コメントに「マルチテナント移行後に role='company' 行の整理が必要」を明記 |
