# biz-members マルチテナント設計書

**作成日**: 2026-04-28
**更新日**: 2026-04-28（実装完了後に同期）
**対象 commit**: M-4 commit 2.6 〜 5、commit 7a〜9-3
**ステータス**: ✅ 実装完了（2026-04-28）

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

> ⚠ 更新 (2026-04-28, commit 2.6b〜2.6e): 全 API Route を `getCompanyContext()`
> ベースに移行完了。`ow_user_roles.role='company'` は非参照になった。

### 2-4. company/register の二重書き

`src/app/api/company/register/route.ts:111` に以下の TODO がある:

```typescript
// TODO: ow_company_admins 移行完了後に ow_user_roles INSERT は削除予定
```

現状は ow_company_admins (permission='admin') と ow_user_roles (role='company') の両方に書いている。
**この設計書の実装が完了するまで、この二重書きは維持する。**

> ⚠ 更新 (2026-04-28, commit 7c + migration 043):
> - commit 7c: `ow_user_roles INSERT` を `register/route.ts` から削除済み
> - migration 043: DB の既存 `role='company'` 行を物理削除（2 行）
> - `addUserRole()` は `role='company'` を明示拒否（早期 return + console.warn）
> - `ow_user_roles` は現在 `candidate` / `admin` のみ保持。二重書きは完全解消。

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

> ⚠ 更新 (2026-04-28, commit 7c + migration 043): 並走は終了。
> commit 7c で INSERT を停止し、migration 043 で既存行を物理削除（2 行削除、0 行残存）。
> ow_user_roles は `candidate` / `admin` 専用テーブルとして確定。

#### G1-4. candidate ロールへの影響

candidate ロールは ow_user_roles に残す（今回のスコープ外）。
変更なし。

---

### G2. getTenantContext() の書き換え

> ⚠ 更新 (2026-04-28, commit 2.6b): 実装時の関数名は **`getCompanyContext`** に変更。
> `src/lib/business/company.ts` に新規追加。シグネチャも一部変更（後述）。
> `getTenantContext()` は `src/lib/business/dashboard.ts` に別途残存しており、
> 役割が異なる: `getCompanyContext` を内部で呼び、さらに会社名・ユーザー名・
> plan 等の表示データを付加して Server Component に返すラッパー関数。

#### G2-1. 新しい読み取りロジック

```typescript
// src/lib/business/company.ts (getCompanyId を置き換える)
// ⚠ 実装時の名前: getCompanyContext (getTenantContext ではない)
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

> ⚠ 更新 (2026-04-28, commit 2.7): `HttpOnly` は設計時 `false` だったが、
> 実装では **`true`** に統一（switch-company / accept / register の全 3 Route）。
> 理由: `biz_current_company_id` はサーバー側で読み取れば十分であり、
> `HttpOnly=true` にすることで XSS 攻撃による読み取りリスクを排除。
> フロントは API レスポンスの `redirectTo` + `window.location.href` で対処。

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

> ⚠ 更新 (2026-04-28, commit 2.8 + commit 8): 以下が実装時に確定。
> - **並び順**: `is_default=true` の企業を先頭固定、残りは `joined_at` ASC（案 Z）
> - **デフォルト表示**: ★ SVG アイコン + "デフォルト" バッジ（選択肢 Y: 表示のみ、変更 UI なし）
> - **「別の会社に参加」リンク**: commit 9-1〜9-3 で `/biz/companies/add/{token,url,new}` として完全実装済み

#### G3-2. API: POST /api/biz/switch-company

```typescript
// body: { company_id: string }
// 処理:
//   1. ow_company_admins で所属確認
//   2. Set-Cookie: biz_current_company_id={company_id}
//   3. { ok: true } を返す
// クライアントは router.refresh() でページを再描画
```

> ⚠ 更新 (2026-04-28, commit 2.7): レスポンス形式は `{ ok: true }` ではなく
> `{ success: true, redirectTo: "/biz/dashboard" }` に変更。
> クライアントは `router.refresh()` ではなく `window.location.href = data.redirectTo`
> でフルリロード（SSR Cookie 再読み取りのため）。

#### G3-3. CompanySwitcher コンポーネント

```typescript
// src/app/biz/_components/CompanySwitcher.tsx
// - 所属企業一覧を Server Component で fetch して props に渡す
// - 1社のみ: <span>{companyName}</span>（クリック不可）
// - 複数社: <button> + DropdownMenu
// - 切り替え時: POST /api/biz/switch-company → router.refresh()
```

> ⚠ 更新 (2026-04-28, commit 2.8): 実際のファイルパスは
> `src/components/business/CompanySwitcher.tsx`（設計時の `src/app/biz/_components/` ではない）。
> 実装時に既存の `src/components/business/` ディレクトリ構造に合わせた。

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

> ⚠ 更新 (2026-04-28, commit 4): 「はい（同一ユーザーに紐付け）」選択肢は実装せず。
> `MismatchState` は**ログアウト一択**（「別のアカウントでログイン」のみ）。
> 理由: (1) 現時点で使われるケースが想定しにくい、(2) 「はい」を選択した場合の挙動が
> ユーザーに伝わりにくい、(3) ログアウト一択がシンプルで意図が明確。
> ログアウト後は magic link / パスワードで招待先メールにログインし直す。

#### G4-3. 複数企業への招待を同一ユーザーが受諾する場合

- 受諾のたびに `ow_company_admins` に行が追加される（問題なし）
- 最初に受諾した企業が `is_default=true`、2 社目以降は `is_default=false`
- Cookie は最後に受諾した企業に更新される（ユーザーは切り替え UI で戻れる）

---

## 4. Commit 計画

| Commit | 内容 | 主要ファイル | 状態 |
|--------|------|------------|------|
| **2.6** | DB migration: joined_at + is_default + data migration + getCompanyContext 追加 | `supabase/migrations/042_multitenant_admins.sql`, `src/lib/business/company.ts` | ✅ 完了 |
| **2.7** | current_company_id Cookie + /api/biz/switch-company API | `src/app/api/biz/switch-company/route.ts`, `src/middleware.ts`（最小変更） | ✅ 完了 |
| **2.8** | CompanySwitcher UI + ヘッダー組み込み | `src/components/business/CompanySwitcher.tsx`, biz layout | ✅ 完了 |
| **3** | accept-invite API（マルチテナント版） | `src/app/api/biz/members/accept/route.ts` | ✅ 完了 |
| **4** | accept-invite ページ（G4-2 メール不一致 UI） | `src/app/biz/auth/accept-invite/page.tsx` | ✅ 完了 |
| **5** | pending 表示 UI（members 管理画面） | `src/app/biz/members/page.tsx` | ✅ 完了 |
| **2.6f** | deprecated 関数削除（getCompanyId / getOwUserId） | `src/lib/business/company.ts` | ✅ 完了 |
| **7a** | roles.ts リファクタ（getUserRoles → ow_company_admins ベース） | `src/lib/roles.ts` | ✅ 完了 |
| **7b** | /api/roles + fetchTeamMembers を ow_company_admins に移行（UUID バグ修正含む） | `src/app/api/roles/route.ts`, `src/lib/business/jobs.ts` | ✅ 完了 |
| **7c** | register から ow_user_roles INSERT 削除 | `src/app/api/company/register/route.ts` | ✅ 完了 |
| **migration 043** | ow_user_roles の role='company' 行を物理削除 | `supabase/migrations/043_cleanup_ow_user_roles_company.sql` | ✅ 完了 |
| **commit 8** | CompanySwitcher にデフォルト会社マーク追加 | `src/components/business/CompanySwitcher.tsx` | ✅ 完了 |
| **9-1** | /biz/companies/add 選択画面 + CompanySwitcher リンク有効化 | `src/app/biz/companies/add/page.tsx` | ✅ 完了 |
| **9-2** | token / URL 入力で参加ページ | `src/app/biz/companies/add/token/`, `src/app/biz/companies/add/url/` | ✅ 完了 |
| **9-3** | 新規会社作成ページ + register API Cookie セット | `src/app/biz/companies/add/new/`, `src/app/api/company/register/route.ts` | ✅ 完了 |

---

## 5. リスク・注意点

| リスク | 対策 | 結果 |
|--------|------|------|
| getTenantContext 書き換えで既存の /biz/company・/biz/dashboard が壊れる | commit 2.6 後に全 biz ページの動作確認を必須とする | ✅ 段階的 commit (2.6a〜2.6e) で個別確認 |
| is_default が 2 行以上になる（partial unique index の抜け） | migration の data migration SQL を慎重に検証。UNIQUE INDEX が張られていれば DB レベルで防止 | ✅ UNIQUE INDEX が機能。違反時は DB エラーで即検知 |
| Cookie の company_id が古くなる（退職後も残留） | getTenantContext の Step 2 で所属確認し、不正 Cookie は無視して fallback へ | ✅ getCompanyContext が fallback 実装済み |
| company/register の二重書きを忘れて削除してしまう | commit 2.6 では register/route.ts は変更しない。削除は後続 migration で明示的に対応 | ✅ commit 7c で明示的に削除、migration 043 で DB も整理 |
| ow_user_roles のデータが増殖し続ける | commit 2.6 の TODO コメントに「マルチテナント移行後に role='company' 行の整理が必要」を明記 | ✅ migration 043 で物理削除。addUserRole() は role='company' を拒否 |

---

## 6. Implementation History

### Phase 1: M-4 Core（13 commits、2026-04-28）

| Commit | 内容 |
|--------|------|
| 38f881f | `docs(plans): biz-members multitenant design`（本設計書作成） |
| f4bac92 | M-4 commit 2.5（ow_user_roles への追記方式、後に revert） |
| 2d41bef | `revert: M-4 commit 2.5`（UNIQUE 制約の問題判明） |
| 126bcf4 | M-4 commit 2.6a — migration 042（joined_at + is_default + data migration） |
| a7ccc1d | M-4 commit 2.6b — `getCompanyContext` 追加 + members POST 移行 |
| ae4099a | M-4 commit 2.6c — invite + [id] routes 移行 |
| d1eb1bd | M-4 commit 2.6d — company + photos routes 移行 |
| 40bd00c | M-4 commit 2.6e — jobs, meetings, dashboard 移行 |
| b84e6d7 | M-4 commit 2.7 — switch-company API + select-company page |
| a8fcb8d | M-4 commit 2.8 — CompanySwitcher UI + header 組み込み |
| 6368aa0 | M-4 commit 3 — POST /api/biz/members/accept |
| 30a481c | M-4 commit 4 — /biz/auth/accept-invite page |
| fec7b9f | M-4 commit 5 — pending invitations UI（members 管理画面） |

### Phase 2: Post-M-4 Cleanup（1 commit）

| Commit | 内容 |
|--------|------|
| 9a0e8d7 | M-4 commit 2.6f — deprecated `getCompanyId` / `getOwUserId` 削除 |

### Phase 3: roles.ts リファクタ + ow_user_roles 完全移行（5 commits）

| Commit | 内容 |
|--------|------|
| 23d2c04 | `fix(biz/company/photos)`: POST が 200 を返していたのを 201 に統一 |
| 2752c41 | commit 7a — `roles.ts`: `getUserRoles` を `ow_company_admins` ベースに移行 |
| b004d34 | commit 7b — `/api/roles` + `fetchTeamMembers` を `ow_company_admins` に移行（UUID バグ修正含む） |
| cf6f140 | commit 7c — `register/route.ts` から `ow_user_roles INSERT` 削除 |
| 2247173 | commit 7d — migration 043: `ow_user_roles role='company'` 行を物理削除 |

### Phase 4: UX Polish（4 commits）

| Commit | 内容 |
|--------|------|
| 25d8fda | commit 8 — CompanySwitcher に ★ + "デフォルト" バッジ追加 |
| 65342cb | commit 9-1 — `/biz/companies/add` 選択画面 + CompanySwitcher リンク有効化 |
| 7b50c85 | commit 9-2 — token / URL 入力で参加ページ |
| fea0478 | commit 9-3 — 新規会社作成ページ + register API Cookie セット追加 |

---

## 7. Design Decisions Made During Implementation

設計書作成時に未確定だった項目、または実装時に変更した項目:

| # | 項目 | 設計時 | 確定値 | Commit |
|---|------|--------|--------|--------|
| 1 | 新関数名 | `getTenantContext`（company.ts に追加） | **`getCompanyContext`**（company.ts）。`getTenantContext` は dashboard.ts にラッパーとして別途残存 | 2.6b |
| 2 | switch-company API レスポンス | `{ ok: true }` | `{ success: true, redirectTo: "/biz/dashboard" }` | 2.7 |
| 3 | register API レスポンス | 記述なし | `{ success, redirectTo, company_id, company }` + `biz_current_company_id` Cookie | 9-3 |
| 4 | CompanySwitcher 並び順 | 未確定（議論ポイント） | **案 Z**: `is_default=true` 先頭固定 + `joined_at` ASC | 2.8 |
| 5 | デフォルト変更 UI | 未確定（議論ポイント） | **選択肢 Y（表示のみ）**: ★ SVG + "デフォルト" バッジ、変更 UI なし | commit 8 |
| 6 | CompanySwitcher ファイルパス | `src/app/biz/_components/CompanySwitcher.tsx` | `src/components/business/CompanySwitcher.tsx`（既存構造に合わせた） | 2.8 |
| 7 | Cookie HttpOnly | `false` | **`true`**（XSS リスク排除。サーバー側読み取りで十分） | 2.7 |
| 8 | 「別の会社に参加」 | 将来実装 | `/biz/companies/add/{token,url,new}` として**完全実装済み** | 9-1〜9-3 |
| 9 | ow_user_roles role='company' | 並走維持（後続 migration で整理） | migration 043 で**物理削除完了**。`addUserRole()` は拒否 | 7c + 043 |
| 10 | G4-2 メール不一致「はい」 | ログイン中ユーザーを invited_email に紐付け | **実装せず（ログアウト一択）**。ユーザーの意図が曖昧になるため | commit 4 |

---

## 8. Technical Lessons Learned

### Cookie 形式（@supabase/ssr v0.10）

`@supabase/ssr` v0.10 の Cookie は `encodeURIComponent(JSON.stringify(session))` を
3180 文字で分割して `sb-{projectRef}-auth-token.0`, `.1`, ... と連番suffix で保存する。
`base64-` プレフィックス形式は古いバージョンの形式なので注意。
curl テストでは全 chunk を `;` で繋いで `Cookie:` ヘッダーに渡す。

### Next.js `redirect()` の罠

Server Component の `try/catch` 内で `redirect()` を呼ぶと、内部的に throw される
`RedirectError` が catch に飲み込まれる。`isRedirectError(e)` で判定して re-throw が必要:

```typescript
import { isRedirectError } from "next/dist/client/components/redirect";
try {
  // ...
  redirect("/biz/dashboard");
} catch (e) {
  if (isRedirectError(e)) throw e; // ← 必須
  setError("...");
}
```

### Server Component から Cookie set はできない

Cookie set は Route Handler 専用。Server Component は Cookie の**読み取りのみ**可能。
Cookie をセットする必要がある処理（switch-company, accept-invite, register）は
必ず API Route 経由で行い、`NextResponse.cookies.set()` を使う。

### Magic Link でパスワードなし curl テスト

パスワードを共有せず安全にテストする方法:

```
1. admin.auth.admin.generateLink({ type: 'magiclink', email }) で OTP 取得
2. anon.auth.verifyOtp({ email, token: otp, type: 'email' }) でセッション取得
3. encodeURIComponent(JSON.stringify(session)) を 3180 文字分割して Cookie 構築
4. curl -H "Cookie: sb-{ref}-auth-token.0=...; biz_current_company_id=..." でテスト
```

generateLink と verifyOtp は連続して呼ぶこと（2 回目の generateLink が 1 回目の OTP を
無効化するため）。

### `getCompanyContext` の責務分担

- `getCompanyContext(supabase, authUserId, cookieId?)` → `CompanyContext`（純粋な ID 解決）
- `getTenantContext()` → `TenantContext`（getCompanyContext + 表示データ付きラッパー）
- Server Component は `getTenantContext()` を呼ぶ
- API Route は `getCompanyContext()` を直接呼ぶ（表示データ不要なため）

---

## 9. Bugs Found and Fixed

| バグ | 発見タイミング | 修正 commit |
|------|--------------|------------|
| `fetchTeamMembers` UUID mismatch: `auth.users.id` で `ow_users.id` を検索していた（常に 0 件） | commit 7b のテスト中 | 7b（ow_company_admins ベース移行で副次的に解消） |
| photos POST が 200 を返していた（他のエンドポイントは 201） | Phase 3 ソースレビュー中 | 23d2c04 |
| `/biz/auth` の `next` パラメータに Open Redirect 脆弱性（外部 URL へのリダイレクト可能） | commit 4 実装中 | commit 4（`next` を allowlist で検証） |
| pending 招待行が `name: "—"` でアクティブメンバー一覧に混入 | commit 5 のテスト中 | commit 5（`is_active=true` フィルタ追加） |
