# 調査: サインアップフロー & ow_users 二重作成問題
**作成日**: 2026-05-15  
**目的**: 企業アカウント登録時に既存ユーザーが重複 ow_users を持つ可能性の調査

---

## 1. 企業登録フロー現状図

### エントリーポイント

| 起点 | URL / コンポーネント | 遷移先 |
|------|---------------------|--------|
| LP（企業向け）の CTA | `/business` → `BusinessHero` 内のボタン | `/biz/auth` |
| LP 下部 Final CTA | `/business/page.tsx:679` `<Link href="/biz/auth">` | `/biz/auth` |
| `/biz/auth/signup` | `src/app/biz/auth/signup/page.tsx` — `redirect("/biz/auth?mode=signup")` | `/biz/auth?mode=signup` |

エントリーポイントは **すべて `/biz/auth` に集約** されている。`BusinessHeader` コンポーネントにも同ページへのリンクあり。

### 新規登録フロー（`/biz/auth` signup モード）

```
[ユーザー] フォーム入力
  企業名 / 業種 / 従業員数 / 担当者名 / 部署役職 / 企業メール / PW
    ↓
[フロント] SignupForm.handleSubmit()
  src/app/biz/auth/page.tsx:436-495
    ↓
  supabase.auth.signUp({ email, password, options: { data: { name: contactName } } })
  ← この時点で auth.users に INSERT
  ← migration 032 の on_auth_user_created トリガーが発火 → ow_users に INSERT
    ↓ (auth エラーなければ)
  POST /api/company/register
  src/app/api/company/register/route.ts
    ↓
  [API] 認証チェック → supabase.auth.getUser()
  [API] ow_companies INSERT (admin client, RLS bypass)
  [API] ow_users SELECT WHERE auth_id = user.id → ow_company_admins INSERT
  [API] Cookie: biz_current_company_id をセット (30日)
    ↓
  window.location.replace("/biz/dashboard")
```

**重要**: `supabase.auth.signUp()` 成功後、**セッションが有効な状態のまま**で `/api/company/register` を呼ぶ。つまりフロントからの fetch に認証 Cookie が自動付与される。

### メアド重複時の処理

- `authError.message.includes("already registered")` を検知して「このメールアドレスはすでに登録されています」エラー表示 (biz/auth/page.tsx:459-466)
- ただし重複検知は **MOCK_EXISTING_USERS** (`["taro@example.com", "yamada@test.com"]`) のハードコードのみで行われる UI 警告もある (行9, 423-427) — これは Supabase Auth 実処理とは無関係なプレースホルダー

### ログインフロー

```
[ユーザー] メール + PW 入力
  ↓
supabase.auth.signInWithPassword()
  ↓
router.replace(next)  ← next は ?next= クエリパラメータ（デフォルト /biz/dashboard）
```

---

## 2. ユーザー（求職者）登録フロー

**ファイル**: `src/app/(jobseeker)/auth/page.tsx`

### フォーム入力項目
- お名前（本名・ニックネーク可）
- メールアドレス
- パスワード（8文字以上）
- 利用規約チェックボックス
- Google OAuth ボタン（`signInWithOAuth({ provider: "google" })`）

### submit ハンドラー（handleSignup: 行85-140）

```
supabase.auth.signUp({
  email, password,
  options: {
    data: { name: name.trim() || email.split("@")[0] },
    emailRedirectTo: `${origin}/auth/callback?next=${nextUrl}`,
  }
})
  ↓ data.session が存在（メール確認不要設定）の場合
  POST /api/roles  { role: "candidate" }  ← best-effort
  router.push(nextUrl || "/companies")
  ↓ data.session がない（メール確認必要）の場合
  setDone(true) → 確認メール送信完了画面
```

**既存メアド重複の検知**:
- `signUpError.message.includes("already registered")` → ログインタブへ誘導
- `data.user?.identities?.length === 0` → 同様のエラー表示（メール確認前の再登録ケース）

### `?next=` / `?mode=` クエリパラメータのハンドリング

```typescript
// src/app/(jobseeker)/auth/page.tsx:36-41
const rawNext = searchParams.get("next") ?? "";
// Open Redirect 対策: / で始まり // でない内部パスのみ許可
const nextUrl = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

const [mode, setMode] = useState<"signup" | "login">(
  searchParams.get("mode") === "login" ? "login" : "signup"
);
```

`/biz/auth` でも同じパターンを実装（biz/auth/page.tsx:43-47）:
```typescript
const rawNext = searchParams.get("next") ?? "";
const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/biz/dashboard";
```

### signup 完了後の遷移先

| 状態 | 遷移先 |
|------|--------|
| セッション発行済み（メール確認不要） | `nextUrl || "/companies"` |
| メール確認待ち | ページ内完了表示のまま（遷移なし） |
| Google OAuth | `/auth/callback?next=...` を経由してリダイレクト |

---

## 3. ow_users の現状データサマリー

| 指標 | 値 |
|------|----|
| ow_users 総数 | 254 |
| auth.users 総数 | 68 |
| ow_users で auth_id が設定済み | 44 |
| ow_users で auth_id が NULL | **210** |
| ow_company_admins に紐付く ow_users (DISTINCT) | 32 |
| ow_users: 企業所属あり | 32 |
| ow_users: 企業所属なし | 222 |
| auth.users で email 重複 | **0件** (重複なし) |
| auth_id 設定済み ow_users のうち auth.users に対応なし | 0件 (孤立なし) |
| ow_company_admins: active_member | 36件 |
| ow_company_admins: pending_invite | 0件 |

### 重要な発見: auth_id = NULL の ow_users が 210件存在する

これらは **全件メールアドレス形式** (`email LIKE '%@%'`) を持つが、Supabase Auth と紐づいていない。
考えられる原因:
- migration 032 の backfill 実行前に手動 INSERT されたレコード
- 企業の「連絡先担当者」情報として別途 INSERT されたレコード（admin 経由等）
- テストデータ

**auth_id = NULL のユーザーは Supabase Auth 認証でログインできない**。ow_company_admins に紐付いている可能性もあり（user_id カラムが ow_users.id を参照するため）。

### auth.users 68件 vs ow_users(auth_id非NULL) 44件 のギャップ

68 - 44 = **24件**の auth.users に対応する ow_users が存在しない。
これは migration 032 の `ON CONFLICT (auth_id) DO NOTHING` により、既存 auth.users の一部が backfill されなかった可能性がある（CLAUDE.md の既知問題「name 表示の二重経路問題」と関連）。

---

## 4. /biz/companies/add/new の認証前提と現状

**ファイル**: `src/app/biz/companies/add/new/page.tsx`

### 認証チェックの有無

- middleware.ts の `/biz/` 認証ガードが適用される（`needsAuth = true`）
- 未ログインでアクセス → `/biz/auth?next=/biz/companies/add/new` にリダイレクト（middleware.ts:50-54）
- ページ自体は `getTenantContext()` を呼び出し、null なら `<NoTenantPage>` を表示（「企業アカウントが必要です」）

**つまり: ログイン必須だが、企業所属がなくてもアクセス自体はできる。**
`ctx === null` の場合に NoTenantPage を返すが、これは「企業アカウントが必要です」という静的メッセージで、実際の作成フォームは表示されない。

### POST するエンドポイントと ow_users.id の取得方法

`CreateCompanyClient.tsx` の `handleSubmit` → `POST /api/biz/companies` (src/app/api/biz/companies/route.ts)

API 内での ow_users.id 取得 (route.ts:121-128):
```typescript
const { data: owUser } = await admin
  .from("ow_users")
  .select("id, name")
  .eq("auth_id", user.id)   // auth.users.id で照合
  .maybeSingle();
```

`owUser` が見つからない場合 → エラーにしない（ログのみ）。company は作成されるが、ow_company_admins への INSERT がスキップされる。

**同様のパターンが `/api/company/register` にも存在** (route.ts:85-110)。どちらも `ON CONFLICT ... DO NOTHING` で冪等に処理。

---

## 5. redirect クエリパラメータの対応状況

### /biz/auth

- `?next=` パラメータ: **対応済み**（Open Redirect 対策あり、内部パスのみ許可）
- `?mode=` パラメータ: **対応済み**（`"login"` のみ有効、それ以外は signup）
- ログイン成功後: `router.replace(next)` で指定先へ遷移
- signup 成功後: **`next` を無視して `window.location.replace("/biz/dashboard")` に直行**（biz/auth/page.tsx:490-491 コメントより意図的）

### /(jobseeker)/auth

- `?next=` パラメータ: **対応済み**（同様の Open Redirect 対策あり）
- `?mode=` パラメータ: **対応済み**

### 招待フロー（accept-invite）での next 活用

`UnauthenticatedState` (AcceptInviteClient.tsx:128-129):
```typescript
const encodedNext = encodeURIComponent(`/biz/auth/accept-invite?token=${token}`);
const loginHref  = `/biz/auth?mode=login&next=${encodedNext}`;
const signupHref = `/biz/auth?next=${encodedNext}`;
```

招待フローは `?next=` を使ってログイン/signup 後に招待受諾ページへ戻る設計が完成している。

---

## 6. 「既存 signup フロー再利用 + リダイレクトで /biz/companies/add/new に流す」方針の実現可能性論点

### 前提となる想定シナリオ

1. ユーザーが既に求職者アカウント（`/(jobseeker)/auth` で登録済み）を持っている
2. そのユーザーが人事担当者として企業アカウントを作りたい
3. 新たに auth.users / ow_users を作らず、既存アカウントに企業所属を追加したい

### 技術的実現可能性

**実現可能** — 以下の理由から:

1. **ow_users は 1人 1レコード設計**: `auth_id` に UNIQUE 制約があり、migration 032 のトリガーは `ON CONFLICT (auth_id) DO NOTHING` のため、同一 auth.users で再登録しても ow_users の重複は起きない。

2. **企業への紐付けは ow_company_admins で管理**: ow_users と ow_companies の関係は中間テーブル経由のため、1人が複数企業の admin になれる設計。

3. **求職者 signup 後、/biz/auth でログインして企業登録が可能**: 同一メールで Supabase Auth は 1つの auth.users を持つため、求職者と企業担当者のアカウントが共存できる（`UnifiedAccountNotice` コンポーネントがこれを UI で説明している: biz/auth/page.tsx:939-975）。

### 実装上の論点

| 論点 | 詳細 |
|------|------|
| **biz/auth signup は企業情報入力を要求する** | 現フォームに「企業名・業種・従業員数・担当者名・部署役職」が必須。求職者の既存アカウントへの企業追加には不要な入力が多い |
| **signup 完了後 next を無視して /biz/dashboard に直行** | `/biz/companies/add/new` へリダイレクトしたい場合は biz/auth/page.tsx:490 の `window.location.replace("/biz/dashboard")` を `window.location.replace(next || "/biz/dashboard")` に変更が必要 |
| **企業情報フォームの入力値が /api/company/register に渡される** | 「既存ユーザーが企業追加」の場合、企業情報入力を省いて `/biz/companies/add/` → `/biz/companies/add/new` に誘導する方が自然 |
| **ログイン済みの場合は /biz/companies/add/new に直接アクセス可能** | middleware により認証済みなら通過できる。`getTenantContext()` が null でも `NoTenantPage` が表示されるだけで、`CreateCompanyClient` へのアクセス自体は別途機能する（page.tsx:25-27: ctx が null なら `CreateCompanyClient` は表示されない点は要確認） |

### 推奨フロー

「既存求職者アカウントに企業を追加」の場合:
```
/business（LP）の CTA
  → /biz/auth?mode=login&next=/biz/companies/add  ← ログイン誘導
  → ログイン成功後 /biz/companies/add
  → /biz/companies/add/new で企業作成
  → /api/biz/companies で ow_companies + ow_company_admins INSERT
  → /biz/dashboard
```

---

## 7. 既存「企業連絡先用 ow_users」の扱いに関する論点

### 問題の構造

現在 `auth_id = NULL` の ow_users が **210件** 存在する。これらは:
- Supabase Auth で認証できない（auth_id がないため `eq("auth_id", user.id)` でヒットしない）
- ow_company_admins に紐付いている可能性がある（user_id = ow_users.id で結合するため）

つまり「企業の連絡先として手動登録された人」が `/biz/auth` から signup しても、新たな ow_users レコードが作られる（auth_id 付きの新レコード）。**既存の auth_id=NULL レコードとは別物**になり、同一人物が ow_users を複数持つ状態になりうる。

### 「人事が既存求職者ユーザーになるケース」での重複発生フロー

```
[既存状態] ow_users (auth_id=NULL, email="hr@company.com") が存在
      ↓
[人事が /biz/auth で signup]
  supabase.auth.signUp({ email: "hr@company.com", ... })
  → auth.users に INSERT → on_auth_user_created トリガー発火
  → ow_users (auth_id=<uuid>, email="hr@company.com") を INSERT (ON CONFLICT auth_id DO NOTHING)
      ↓
[結果] ow_users に2レコード:
  - auth_id=NULL, email="hr@company.com"  ← 既存（連絡先用）
  - auth_id=<uuid>, email="hr@company.com" ← 新規（Auth連携済み）
```

### auth_id=NULL レコードの ON CONFLICT 動作

migration 032 のトリガー関数は `ON CONFLICT (auth_id) DO NOTHING` を使っている。UNIQUE KEY は `auth_id` 列。NULL 値は SQL の等価比較では等しくないため、**auth_id=NULL 同士の重複は検知されない**。つまり auth_id=NULL のレコードが存在しても、新しいトリガー経由の INSERT（auth_id=非NULL）は問題なく実行される。

**重複は起きるが、auth_id の有無で区別できる**。

### 論点と対応方針案

| 論点 | 詳細 | 対応方針 |
|------|------|---------|
| **auth_id=NULL の 210件の出所** | おそらく初期データ投入や管理者手動 INSERT | 調査して不要なら削除、あるいは今後は auth 経由で統一 |
| **同一 email の auth_id=NULL と auth_id=非NULL が共存** | 重複 ow_users が生まれる | サインアップ時に email で既存 ow_users を検索し、auth_id を backfill するか merge する処理を検討 |
| **ow_company_admins が auth_id=NULL の user_id を参照している場合** | ログイン後にその企業のダッシュボードが見えない | 招待フローで新規 auth.users を作り、auth_id 非NULL の新 ow_users.id に ow_company_admins.user_id を更新する必要がある |
| **Supabase Auth の「already registered」エラー** | 求職者としてすでに登録していた場合、企業登録で signUp を呼ぶと失敗 | biz/auth の signup フォームは同一メアドの auth.users が存在する場合にエラー表示する（行459-466）。ログインタブへ誘導が正しい動線 |

### 根本解決の方針案

| 案 | 内容 | 難易度 |
|----|------|--------|
| A | auth_id=NULL の ow_users を全件調査し不要なら削除 | 低（要手動確認） |
| B | `/biz/auth` signup 成功時に email で既存 ow_users を検索して auth_id を UPDATE する API 処理を追加 | 中（API Route に追加） |
| C | 求職者 auth (/auth) と企業 auth (/biz/auth) でアカウントを完全共用: `/biz/auth` の signup を廃止し、ログインのみにして企業登録は `/biz/companies/add/new` に集約 | 中（フロー再設計） |
| D | ow_users の UNIQUE 制約に (email, auth_id IS NULL) の partial unique index を追加し、email 重複を防ぐ | 中（migration 追加） |

**現時点での最小リスク対応（方針 C 相当）**:
- `/biz/auth` の signup フォームに「すでに Opinio アカウントをお持ちの方はログインから」を強調
- ログイン後に会社がない場合は `/biz/companies/add` に誘導
- `/api/company/register` か `/api/biz/companies` の POST 時に email で既存 ow_users を検索して auth_id を UPSERT する処理を追加（B 案を軽量実装）

---

## ファイル参照一覧

| ファイル | 内容 |
|---------|------|
| `src/app/biz/auth/page.tsx` | 企業 signup/login UI、SignupForm.handleSubmit():436-495 |
| `src/app/biz/auth/signup/page.tsx` | `/biz/auth?mode=signup` へリダイレクトするのみ |
| `src/app/(jobseeker)/auth/page.tsx` | 求職者 signup/login UI、handleSignup():85-140 |
| `src/app/business/page.tsx:679` | LP の Final CTA → `/biz/auth` |
| `src/app/api/company/register/route.ts` | 企業登録 API（ow_companies + ow_company_admins INSERT） |
| `src/app/api/biz/companies/route.ts` | POST /api/biz/companies（/biz/companies/add/new から呼ばれる） |
| `src/app/biz/companies/add/new/page.tsx` | 新規会社作成ページ（認証必須、企業所属なしでも表示） |
| `src/app/biz/companies/add/new/CreateCompanyClient.tsx` | 会社作成フォーム UI |
| `src/app/biz/auth/accept-invite/AcceptInviteClient.tsx` | 招待受諾フロー UI |
| `src/app/api/biz/members/accept/route.ts` | 招待受諾 API |
| `src/middleware.ts` | /biz/ 認証ガード、`?next=` パラメータ付きリダイレクト |
| `supabase/migrations/032_ow_users_trigger_and_backfill.sql` | auth.users → ow_users 自動作成トリガー |
