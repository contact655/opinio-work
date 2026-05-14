# 検証レポート: 招待フロー（Part 1）+ 権限境界（Part 2）

**検証日**: 2026-05-15  
**検証種別**: コード静的解析 + DB確認（Supabase MCP read-only）  
**コード変更**: なし  
**対象commit**: `6413849`（Part 1）、`00a9dc8`（Part 2）

---

## 1. Part 1 コード整合性チェック（Phase 6-9）

### 1-1. AcceptInviteClient — saveInviteAndNavigate()

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| 3つのキーが全て保存されているか | ✅ | `INVITE_TOKEN_KEY`, `INVITED_EMAIL_KEY`, `INVITED_COMPANY_NAME_KEY` を順番に `setItem` |
| signup パスの遷移先 | ✅ | `?context=invite` |
| login パスの遷移先 | ✅ | `?mode=login&context=invite` |
| sessionStorage 失敗時のフォールバック | ✅ | `try/catch` で囲み、失敗しても `window.location.href` で遷移を継続 |
| ボタンは `<a>` ではなく `<button>` か | ✅ | `type="button"` の `<button onClick={...}>` |

### 1-2. /biz/auth — context=invite モード

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `context=invite` の読み取り | ✅ | line 67: `searchParams.get("context") === "invite"` → `isInviteContext` |
| sessionStorage の読み込み条件 | ✅ | `useEffect` 内で `if (!isInviteContext) return` → invite 時のみ実行 |
| token + email の両方がないと `inviteContext` を設定しない | ✅ | line 100: `if (token && email)` でガード |
| `modeParam === "login"` 時の自動タブ切替 | ✅ | line 103: `setMode("login")` |
| `inviteContext` が `null` の状態でのフォールバック | ✅ | `isInviteMode = inviteContext !== null` → null なら通常モード |

### 1-3. SignupForm — 企業フィールド非表示・メアド prefill

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| 企業名・業種・従業員数フィールドの非表示 | ✅ | line 712: `{!isInviteMode && <> ... </>}` で3フィールドをまとめて非表示 |
| メールアドレスの prefill | ✅ | `useState(inviteContext?.email ?? "")` — 初期値で設定 |
| メールアドレスの readOnly | ✅ | `readOnly={isInviteMode}` |
| メールアドレスの onChange 無効化 | ✅ | `onChange={(e) => !isInviteMode && handleEmailChange(...)` |
| 既存ユーザー通知（showExistingNotice）の無効化 | ✅ | `onBlur={!isInviteMode ? handleEmailBlur : undefined}` |

### 1-4. SignupForm — signup 後の自動受諾

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `POST /api/biz/members/accept` の呼び出し | ✅ | line 604–613 |
| 受諾 API 失敗時のエラー表示 | ✅ | `acceptRes.ok` チェック、エラー時は `setError(...)` して return |
| sessionStorage の3キーのクリア | ✅ | line 619–621: `removeItem` × 3 |
| `/biz/dashboard` へのリダイレクト | ✅ | `window.location.replace("/biz/dashboard")` |
| 既存メアドエラー時の invite モード処理 | ✅ | `onSwitchToLogin(email)` 呼び出し（inviteContext は state で保持されたまま） |

### 1-5. LoginForm — ログイン後の自動受諾

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| invite token の取得ロジック（優先順位） | ✅ | `inviteContext?.token` → なければ sessionStorage から fallback（line 1002-1003） |
| `POST /api/biz/members/accept` の呼び出し | ✅ | line 1008–1011 |
| 受諾失敗時のエラー表示 | ✅ | `setError(...)` して return（ダッシュボードへ行かない） |
| sessionStorage の3キーのクリア | ✅ | line 1023–1025: `removeItem` × 3 |
| PENDING_COMPANY_KEY のクリア漏れ | ✅ | invite 成功時は `PENDING_COMPANY_KEY` を参照しない（invite ≠ 通常 new company フロー） |
| `/biz/dashboard` へのリダイレクト | ✅ | `window.location.replace("/biz/dashboard")` |

### 1-6. BrandPanel

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| invite モード時のタイトル変更 | ✅ | `inviteCompanyName` が非 null の場合に専用タイトルを表示 |
| 機能紹介カードの非表示 | ✅ | `{!inviteCompanyName && <div>...機能カード...</div>}` |

**Part 1 総評: 全項目 ✅ 実装上の問題なし。**

---

## 2. Part 2 コード整合性チェック（Phase 10-12）

### 2-1. permissions.ts ヘルパー

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `requireAdmin()` の実装 | ✅ | `allMemberships.find(m => m.companyId === companyId)?.permission !== "admin"` なら throw |
| `permissionDeniedResponse()` | ✅ | `{ error: "...", code: "permission_denied" }` + status 403 |
| `requireMember()` の実装 | ✅ | メンバーシップ自体なければ throw（通常は getCompanyContext で保証済み） |
| 型定義 `Membership` | ✅ | `{ companyId: string; permission: "admin" | "member" }` |

### 2-2. API ルートの admin ガード実装状況

#### ✅ `requireAdmin()` 経由（permissions.ts）

| API ルート | メソッド | ガード位置 |
|-----------|---------|-----------|
| `/api/biz/company` | PUT | `ctx` 取得直後 (line 28) |
| `/api/biz/company` | PATCH | `ctx` 取得直後 (line 78) |
| `/api/biz/company/photos` | POST | `ctx` 取得直後 (line 25) |
| `/api/biz/company/photos/[id]` | PATCH | `ctx` 取得直後 (line 26) |
| `/api/biz/company/photos/[id]` | DELETE | `ctx` 取得直後 (line 74) |
| `/api/biz/company/employee-categories` | POST | `ctx` 取得直後 (line 48) |
| `/api/biz/company/employee-categories/[id]` | DELETE | `ctx` 取得直後 (line 37) |
| `/api/biz/jobs` | POST（新規作成） | `ctx` 取得直後 (line 114) |
| `/api/biz/jobs/[id]` | PUT | `ctx0` 取得直後 (line 31) |
| `/api/biz/jobs/[id]` | PATCH | `ctx1` 取得直後 (line 117) |
| `/api/biz/jobs/[id]` | DELETE | `ctx2` 取得直後 (line 178) |

#### ✅ インライン admin チェック（実質同等）

| API ルート | メソッド | 実装 |
|-----------|---------|------|
| `/api/biz/members/invite` | POST | `actorMembership?.permission !== "admin"` → 403（line 46-48） |
| `/api/biz/members/[id]` | DELETE | `actorMembership?.permission !== "admin"` → 403（line 198-200）※招待キャンセルのみ |
| `/api/biz/members/[id]` | PATCH `update_profile` action | `actorMembership?.permission !== "admin"` → 403（line 148-150） |
| `/api/biz/members` | POST（直接追加） | `actorMembership?.permission !== "admin"` → 403（line 38） |

#### ❌ **admin ガード未実装（バグ）**

**`/api/biz/members/[id]` PATCH — actions: `permission` / `deactivate` / `reactivate`**

```
PATCH /api/biz/members/:id { action: "permission", value: "admin" }
PATCH /api/biz/members/:id { action: "deactivate" }
PATCH /api/biz/members/:id { action: "reactivate" }
```

PATCH ハンドラー冒頭（line 27-48）で `getCompanyContext()` を呼び、同一企業チェックはしているが、**呼び出し元が admin かどうかをチェックしていない**。

- `permission` action（line 64-98）: admin チェックなし。ガードは「自己降格禁止」「最後 admin 降格禁止」のみ
- `deactivate` action（line 100-130）: admin チェックなし。ガードは「自己無効化禁止」「最後 admin 無効化禁止」のみ
- `reactivate` action（line 132-143）: admin チェックなし。ガードなし（is_active = true に更新するだけ）
- `update_profile` action（line 146-173）: ✅ admin チェックあり

**member ユーザーが実行できてしまう操作:**
1. 同じ企業の別メンバーを `admin` に昇格させる（自分を昇格させることも可）
2. 同じ企業の別メンバーを `deactivate` する（admin でなければ deactivate できない、という仕様のはずだが無防備）
3. 無効化されたメンバーを `reactivate` する

#### 補足: ガード対象外（設計上 member でも可）

| API ルート | メソッド | 理由 |
|-----------|---------|------|
| `/api/biz/members/accept` | POST | 認証済みユーザーが自分の招待を受諾する専用エンドポイント |
| `/api/biz/members` | GET | 読み取り専用 |
| `/api/biz/company/employee-categories` | GET/PUT | 読み取り・並び替えは member でも可（設計意図） |
| `/api/biz/meetings/[id]` | PATCH | 面談ステータス更新（member も担当する業務のため admin 限定ではない） |
| `/api/biz/applications/[id]` | PATCH | 申込対応（member も担当） |
| `/api/biz/jobs` | POST（複製モード） | RLS が自社求人のみ保護。admin 限定が望ましいが現状はガードなし |

> **注**: `jobs` POST の複製モード（`sourceId` あり）は `getCompanyContext` を呼ばないまま RLS で保護している設計。admin 限定にするか否かは要相談（現状 member でも複製可）。

### 2-3. TenantContext + UI 出し分け

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `currentPermission` フィールドの型 | ✅ | `"admin" \| "member"` |
| 計算ロジック | ✅ | `allMemberships.find(m => m.companyId === tenantId)?.permission ?? "member"` |
| fallback が `"member"` | ✅ | `?? "member"` — 見つからない場合は安全側に倒す |
| `biz/company/page.tsx` | ✅ | `isAdmin={ctx.currentPermission === "admin"}` を CompanyEditClient へ渡す |
| `biz/jobs/page.tsx` | ✅ | `isAdmin={ctx.currentPermission === "admin"}` を JobsClient へ渡す |
| `biz/members/page.tsx` | ✅ | `isAdmin={ctx.currentPermission === "admin"}` を MembersClient へ渡す |
| CompanyEditClient 公開ボタン | ✅ | `{isAdmin && <button>変更を公開する</button>}` |
| JobsClient 求人作成リンク | ✅ | `{isAdmin && <Link>新規求人を作成</Link>}` |
| MembersClient 招待ボタン | ✅ | `{isAdmin && <button>メンバーを追加</button>}` |
| MembersClient DropdownMenu | ✅ | `{isAdmin && <DropdownMenu>}` — 権限変更・除名ボタン全体を非表示 |

---

## 3. sessionStorage キー命名規則

### 全使用箇所（biz/ 配下）

| キー名 | 定数名 | 使用ファイル | 用途 |
|--------|--------|------------|------|
| `opinio_biz_pending_company` | `PENDING_COMPANY_KEY` | `biz/auth/page.tsx` | 新規登録フロー: signup→login 切替時の企業情報退避 |
| `opinio_biz_invite_token` | `INVITE_TOKEN_KEY` | `biz/auth/page.tsx`, `accept-invite/AcceptInviteClient.tsx` | 招待トークン |
| `opinio_biz_invited_email` | `INVITED_EMAIL_KEY` | 同上 | 招待先メールアドレス |
| `opinio_biz_invited_company_name` | `INVITED_COMPANY_NAME_KEY` | 同上 | 招待元企業名 |

### 命名規則の評価

- プレフィックス: 全て `opinio_biz_` で統一 ✅
- セパレータ: アンダースコア統一 ✅（ハイフン混在なし）
- 2ファイルで同一キー名を定数として独立定義している（共有モジュール化していない）

> **論点**: `INVITE_TOKEN_KEY` 等の3定数が `biz/auth/page.tsx` と `AcceptInviteClient.tsx` に重複定義されている。現状は値が一致しているため動作上問題なし。共通化するなら `@/lib/auth/storageKeys.ts` 等に切り出す選択肢があるが、今回は修正せず論点として残す。

---

## 4. DB 状態（テーブル別）

### 4-1. ow_company_admins スキーマ

| カラム | 型 | Nullable | デフォルト | 用途 |
|-------|-----|----------|-----------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | **YES** | null | NULL = 未受諾招待 |
| company_id | uuid | NO | — | FK |
| department | text | YES | null | 部署 |
| role_title | text | YES | null | 役職 |
| permission | text | NO | `'member'` | "admin" / "member" |
| is_active | boolean | NO | true | 有効フラグ |
| created_at | timestamptz | NO | now() | — |
| invited_by_user_id | uuid | YES | null | 招待者 |
| invitation_token | text | YES | null | UUID 文字列（受諾後 null クリア） |
| invited_email | text | YES | null | 招待先メアド（受諾後 null クリア） |
| invited_at | timestamptz | YES | null | 招待日時 |
| accepted_at | timestamptz | YES | null | 受諾日時 |
| joined_at | timestamptz | YES | null | 参加日時 |
| is_default | boolean | NO | false | デフォルト企業フラグ |

**確認事項:**
- `permission` は **text 型**（DB 制約なし）。コード側で `"admin" | "member"` に制限。enum 化は未実施
- `expires_at` カラムは**存在しない**。有効期限は `invited_at + 7日` をアプリ側で計算（`accept/route.ts` line 43, `accept-invite/page.tsx` line 42）

### 4-2. ow_company_admins 現状レコード数

| row_type | permission | is_active | 件数 |
|---------|-----------|-----------|-----|
| member（user_id あり） | admin | true | 33 |
| member（user_id あり） | admin | false | 1 |
| member（user_id あり） | member | true | 2 |
| pending_invite（user_id IS NULL） | — | — | **0** |

> 現在、未受諾の招待はゼロ。招待フローは DB レベルでは正常に機能する状態。

### 4-3. ow_company_join_requests（論点2 確認）

- レコード数: **0 件**
- コード参照: **0 件**（全 `.ts` / `.tsx` ファイルで grep → 一致なし）
- 結論: 完全に休眠テーブル。廃棄判断してよい状態。

---

## 5. API 挙動の確認

### 前提

member 権限の実アカウントを使った curl テストは、セッション cookie の取得手順が手動のため本検証では実施しなかった。以下はコード解析による予測挙動。Hisato さんの手動検証（シナリオ 9-10）で実ブラウザ確認を推奨。

### 5-1. 編集系 API — member アクセス時の期待挙動

| エンドポイント | メソッド | 期待レスポンス | 根拠 |
|-------------|---------|-------------|------|
| `PATCH /api/biz/company` | PATCH | 403 `permission_denied` | requireAdmin line 78 |
| `PUT /api/biz/company` | PUT | 403 `permission_denied` | requireAdmin line 28 |
| `POST /api/biz/jobs` | POST | 403 `permission_denied` | requireAdmin line 114 |
| `DELETE /api/biz/jobs/:id` | DELETE | 403 `permission_denied` | requireAdmin ctx2 line 178 |
| `POST /api/biz/members/invite` | POST | 403（inline check） | `actorMembership?.permission !== "admin"` line 47 |
| `PATCH /api/biz/members/:id` (`permission` action) | PATCH | **200（誤った動作）** ⚠️ | admin チェックなし — **バグ** |
| `PATCH /api/biz/members/:id` (`deactivate` action) | PATCH | **200（誤った動作）** ⚠️ | admin チェックなし — **バグ** |

### 5-2. 招待受諾 API — 特殊ケース

| ケース | エンドポイント | 期待レスポンス | 実装箇所 |
|------|-------------|-------------|---------|
| トークンなし | `POST /api/biz/members/accept` | 400 `INVALID_TOKEN` | line 23 |
| UUID 形式不正 | 同上 | 400 `INVALID_TOKEN` | line 23 |
| 存在しないトークン | 同上 | 404 `TOKEN_NOT_FOUND_OR_USED` | line 38 |
| 受諾済みトークン（user_id あり） | 同上 | 404 `TOKEN_NOT_FOUND_OR_USED` | `.is("user_id", null)` の WHERE 条件で弾く |
| 期限切れ（7 日超過） | 同上 | 410 `TOKEN_EXPIRED` | line 44 |
| 未ログイン | 同上 | 401 `LOGIN_REQUIRED` | line 52 |
| メアド不一致 | 同上 | 403 `EMAIL_MISMATCH` | line 58-62 |
| 既存メンバー（already member） | 同上 | 409 `ALREADY_MEMBER` | line 87 |
| 正常ケース | 同上 | 200 `{ success: true, ... }` + Cookie | line 116-128 |

---

## 6. シナリオ 8（メアド不一致）のコード調査

### 6-1. accept-invite/page.tsx（サーバーサイド）

line 74-86 で**サーバーサイドの email 一致チェック**を実施:

```typescript
const loggedInEmail = (user.email ?? "").toLowerCase().trim();
const invitedEmail = (inviteRow.invited_email ?? "").toLowerCase().trim();

if (loggedInEmail !== invitedEmail) {
  return <AcceptInviteClient state="mismatch" ... />;
}
```

ログイン済みユーザーが他人宛の招待 URL を開いた場合、`MismatchState` コンポーネントが表示される。

### 6-2. accept/route.ts（API サイド）

line 56-63 で**API サイドの email 一致チェック**（防御の二重化）:

```typescript
if (loggedInEmail !== invitedEmail) {
  return err(403, "EMAIL_MISMATCH", "...", { invited_email, logged_in_email });
}
```

### 6-3. sessionStorage 経由のパスでの挙動

招待ページで「ログインして受諾」→ sessionStorage に token 保存 → `/biz/auth?mode=login&context=invite` へ遷移 → ログインした場合:

- 招待先メアドが email prefill されているが **readOnly ではない**（LoginForm は readOnly 設定なし）
- ユーザーが email を書き換えて、別アカウントでログインした場合:
  - accept API が `403 EMAIL_MISMATCH` を返す
  - LoginForm が `"招待の受諾に失敗しました"` エラーを表示
  - ダッシュボードへは遷移しない ✅（セキュリティ上は安全）
  - ただし error message が汎用的で「メアドが違う」という理由が伝わりにくい ⚠️（UX 課題）

### 6-4. signup パスでの挙動

SignupForm では `readOnly={isInviteMode}` でメアドが固定されるため、招待先以外のメアドでの signup は不可能。✅

### 6-5. 論点: 不一致時の UX

**現状**: ログインフォームのメアド欄は readOnly でないため、ユーザーが招待先と異なるアカウントでログインすると「招待の受諾に失敗しました。招待リンクから再度お試しください。」と表示される。

**改善案（修正は行わない、論点として記載）**: accept API の `EMAIL_MISMATCH` エラーコードを LoginForm で検出し「招待先のメールアドレス（xxx@...）でログインしてください」という具体的なメッセージを出す。または LoginForm の invite モードでもメアドを readOnly にする。

---

## 7. 残存論点の現状

### 論点2: ow_company_join_requests

| 確認項目 | 状態 |
|---------|------|
| レコード件数 | 0 件 |
| コード参照 | 0 件（全ソースで grep → 一致なし） |
| 判断 | **廃棄してよい。DROP TABLE で整理可能** |

### 論点3: ヘッダーバッジ「(2)」

調査ドキュメント（`docs/investigation-2026-05-15-team-invitation.md` section 8）の記録と現状:

> 「現在のコードベースには "(2)" に相当するバッジ実装は存在しない」

`00a9dc8` の変更後も `BusinessLayout.tsx` にバッジ実装は追加されていない。  
→ **現在も未実装のまま。将来の通知機能実装時に対応する項目として継続。**

---

## 8. 検証で発見した懸念事項一覧（Hisato さんへの相談用）

### ❌ バグ（要対応）

**B-1: `/api/biz/members/[id]` PATCH — `permission`/`deactivate`/`reactivate` action に admin チェックなし**

- **影響**: member ユーザーが他メンバーの権限変更・無効化・再有効化を実行できる
- **悪用シナリオ**: member が自分自身を admin に昇格させる（`{ action: "permission", value: "admin" }` を自分の id に送る）
- **該当ファイル**: `src/app/api/biz/members/[id]/route.ts` line 63-143
- **修正方針案**: PATCH ハンドラー冒頭（line 48 以降）に `requireAdmin` を追加。ただし `update_profile` は admin 限定が正しいので現状維持。
- **緊急度**: 高（権限エスカレーションが可能なため）

---

### ⚠️ 懸念（要相談）

**W-1: `jobs` POST 複製モード（`sourceId` あり）に admin チェックなし**

- **影響**: member ユーザーが既存求人を複製できる（新規作成はブロックされるが複製は可能）
- **該当**: `src/app/api/biz/jobs/route.ts` line 48-99
- **コメント**: RLS でそのテナントの求人のみアクセス可能なため、他社求人を複製する攻撃は不可。自社求人の複製を member に許可するかどうかは設計の判断。

**W-2: `permission` が DB レベルで text 型（enum 制約なし）**

- **影響**: DB 直操作で `"superadmin"` 等の不正値を入れることができる
- **コード側**: `requireAdmin` は `m?.permission !== "admin"` で判定するため、不正値は `"admin"` 以外として扱われ member 相当になる（実害は限定的）
- **修正方針案**: `ALTER TABLE ow_company_admins ADD CONSTRAINT check_permission CHECK (permission IN ('admin', 'member'));` を migration で追加

**W-3: LoginForm の invite モードでメアドが readOnly でない**

- **影響**: B-1 とは独立。ユーザーが招待先と異なるアカウントでログインした場合、エラーメッセージが汎用的で原因がわかりにくい
- **緊急度**: 低（セキュリティ上は accept API が 403 を返すため問題なし。UX 課題）

---

### ✅ 想定通り動いている箇所（サマリー）

- Part 1 の招待フロー全体（sessionStorage リレー、invite モード、自動受諾、sessionStorage クリア）
- Part 2 の admin ガード（11 API メソッドに正しく実装）
- accept API の 8 種エラーハンドリング（INVALID_TOKEN / TOKEN_NOT_FOUND / TOKEN_EXPIRED / LOGIN_REQUIRED / EMAIL_MISMATCH / ALREADY_MEMBER / DB_ERROR）
- メアド不一致の二重防御（page.tsx サーバーサイド + accept API）
- sessionStorage キー命名の一貫性（全て `opinio_biz_` プレフィックス）
- DB の `permission` fallback が `"member"`（安全側）
- `ow_company_join_requests` は 0 件・0 参照で廃棄判断可能
