# 実装レポート: 招待受諾フロー + 権限境界 (Phase 6-12)

**実装日**: 2026-05-15  
**担当**: Claude Sonnet (セッション 2件にまたがる)  
**コミット**: `6413849` (Part 1) → `00a9dc8` (Part 2)

---

## 背景と目的

`/biz/members` の招待機能は DB・API レベルでは実装済みだったが、**未登録ユーザーへの招待受諾フロー**がつながっていなかった（招待メールリンク → 受諾ページ表示まで動くが、そこから signup して自動受諾する経路がなかった）。

また、メンバー（非admin）ユーザーが企業情報の公開・求人作成・メンバー管理などの **管理者専用操作** を実行できてしまう権限漏れがあった。

本実装でこの 2 点を解消した。

---

## Part 1: 招待フロー（Phase 6-9）— commit 6413849

### Phase 6: permissions.ts ヘルパー

`src/lib/auth/permissions.ts` を新規作成。

```typescript
export class PermissionDeniedError extends Error { ... }
export function requireAdmin(allMemberships, companyId): void { ... }
export const permissionDeniedResponse = () => NextResponse.json({ error: "...", code: "permission_denied" }, { status: 403 });
```

### Phase 7: AcceptInviteClient — sessionStorage リレー

`src/app/biz/auth/accept-invite/AcceptInviteClient.tsx` の `UnauthenticatedState` を修正。

- 「アカウントを作成して参加」「ログインして参加」ボタンを `<a>` → `<button>` に変更
- クリック時に sessionStorage へ 3 キーを保存してからナビゲート:
  - `opinio_biz_invite_token` — 招待トークン
  - `opinio_biz_invited_email` — 招待先メール
  - `opinio_biz_invited_company_name` — 企業名
- 遷移先: `/biz/auth?context=invite`（signup）or `?mode=login&context=invite`（login）

### Phase 8 & 9: /biz/auth — invite モード対応

`src/app/biz/auth/page.tsx` を大幅修正。

**BrandPanel**: `inviteCompanyName` prop を追加  
- invite モード時は「〇〇 の採用チームに参加」タイトル + 会社名 subtitle を表示  
- 機能紹介カードを非表示

**SignupForm**: `inviteContext` prop を追加  
- `isInviteMode` フラグで企業名・業種・従業員数フィールドを非表示  
- メールアドレスを `inviteContext.email` で prefill、`readOnly` に  
- サインアップ成功後、`POST /api/biz/members/accept` を自動コール → sessionStorage クリア → `/biz/dashboard` へリダイレクト

**LoginForm**: `inviteContext` prop を追加  
- メール prefill（invite email が優先）
- ログイン成功後、inviteToken を確認して自動受諾 → `/biz/dashboard`

---

## Part 2: 権限境界（Phase 10-12）— commit 00a9dc8

### Phase 11: API ルート admin ガード

以下の全 API Route に `requireAdmin()` チェックを追加。非 admin は 403 `permission_denied` を返す。

| ファイル | メソッド | ガード内容 |
|---------|---------|---------|
| `/api/biz/company/route.ts` | PUT, PATCH | 企業情報の保存・公開 |
| `/api/biz/company/photos/route.ts` | POST | オフィス写真アップロード |
| `/api/biz/company/photos/[id]/route.ts` | PATCH, DELETE | オフィス写真の編集・削除 |
| `/api/biz/company/employee-categories/route.ts` | POST | 従業員カテゴリ追加 |
| `/api/biz/company/employee-categories/[id]/route.ts` | DELETE | 従業員カテゴリ削除 |
| `/api/biz/jobs/route.ts` | POST | 求人作成・複製 |
| `/api/biz/jobs/[id]/route.ts` | PUT, PATCH, DELETE | 求人編集・ステータス変更・削除 |

`jobs/[id]/route.ts` はリファクタリングも実施:
- PUT で `getCompanyContext()` を UPDATE の前に移動（早期権限チェック）
- `ctx0`/`ctx1`/`ctx2` の命名で activity ログ用 ctx を再利用（二重呼び出し解消）

### Phase 12: TenantContext + UI 出し分け

**`src/lib/business/dashboard.ts`**:
```typescript
// TenantContext 型に追加
currentPermission: "admin" | "member";

// getTenantContext() 内で計算
const currentPermission = ctx.allMemberships.find(m => m.companyId === tenantId)?.permission ?? "member";
```

**3 ページの Server Component** (`biz/company/page.tsx`, `biz/jobs/page.tsx`, `biz/members/page.tsx`):  
`isAdmin={ctx.currentPermission === "admin"}` を Client Component へ渡す。

**UI ゲーティング**:

| Component | 非 admin 時の変化 |
|-----------|----------------|
| `CompanyEditClient` | 「変更を公開する」ボタン非表示 |
| `JobsClient` | 「新規求人を作成」リンク非表示 |
| `MembersClient` | 「メンバーを追加」ボタン + 各メンバーの DropdownMenu（権限変更・除名）非表示 |

---

## テストシナリオ一覧

### シナリオ 5: 未登録ユーザーへの招待 → signup → 自動受諾
1. `/biz/members` でメールアドレスを入力して招待送信
2. 招待メールのリンクを開く → `/biz/auth/accept-invite?token=xxx`
3. 「アカウントを作成して参加」ボタンをクリック
4. sessionStorage に token/email/companyName が保存されること
5. `/biz/auth?context=invite` へ遷移
6. サインアップフォーム: 企業フィールドなし、メール prefill & readOnly
7. BrandPanel: 「〇〇 の採用チームに参加」表示、機能カードなし
8. サインアップ完了 → `/biz/dashboard` にリダイレクト
9. `/biz/members` でメンバー一覧に表示されること

### シナリオ 6: 登録済みユーザーへの招待 → login → 自動受諾
1. 招待リンクを開く → `UnauthenticatedState`
2. 「ログインして参加」クリック → `/biz/auth?mode=login&context=invite`
3. ログイン完了 → `/biz/dashboard`
4. `/biz/members` で確認

### シナリオ 7: 招待ページを直接開いた場合のフォールバック
- sessionStorage なしで `/biz/auth?context=invite` を直接開く
- email prefill なし・企業フィールドなし（context=invite の場合）
- 通常サインアップとして動作、invite accept は行われない

### シナリオ 8: admin ユーザーは全 UI を見られる
- admin アカウントで `/biz/company` → 「変更を公開する」ボタン表示
- `/biz/jobs` → 「新規求人を作成」ボタン表示
- `/biz/members` → 「メンバーを追加」ボタン・各メンバーの DropdownMenu 表示

### シナリオ 9: member ユーザーは管理 UI が非表示
- member アカウントで `/biz/company` → 公開ボタン非表示（読み取り専用）
- `/biz/jobs` → 求人作成ボタン非表示
- `/biz/members` → 招待ボタン・DropdownMenu 非表示

### シナリオ 10: member による API 直打ちは 403
- member アカウントでログイン
- `PUT /api/biz/company` → 403 `permission_denied`
- `POST /api/biz/jobs` → 403
- `DELETE /api/biz/jobs/:id` → 403

### シナリオ 11: admin による操作は正常に完了
- admin アカウントで企業情報編集 → 「変更を公開する」→ 成功
- 求人作成 → 成功
- メンバー招待 → 成功

### シナリオ 12: invite token が期限切れ・無効の場合
- 受諾 API が 4xx を返す
- SignupForm にエラートーストが表示される
- ダッシュボードへは遷移しない

---

## ファイル変更サマリー

### 新規作成
- `src/lib/auth/permissions.ts` — requireAdmin / permissionDeniedResponse

### 変更
- `src/app/biz/auth/accept-invite/AcceptInviteClient.tsx` — sessionStorage リレー
- `src/app/biz/auth/page.tsx` — invite モード (context=invite) 対応
- `src/lib/business/dashboard.ts` — TenantContext.currentPermission 追加
- `src/lib/business/mockTenantContext.ts` — currentPermission: "admin" 追加
- `src/app/biz/company/page.tsx` — isAdmin を CompanyEditClient へ渡す
- `src/app/biz/company/CompanyEditClient.tsx` — isAdmin prop + 公開ボタンゲート
- `src/app/biz/jobs/page.tsx` — isAdmin を JobsClient へ渡す
- `src/app/biz/jobs/JobsClient.tsx` — isAdmin prop + 求人作成リンクゲート
- `src/app/biz/members/page.tsx` — isAdmin を MembersClient へ渡す
- `src/app/biz/members/MembersClient.tsx` — isAdmin prop + 招待・DropdownMenu ゲート
- `src/app/api/biz/company/route.ts` — admin guard
- `src/app/api/biz/company/photos/route.ts` — admin guard
- `src/app/api/biz/company/photos/[id]/route.ts` — admin guard
- `src/app/api/biz/company/employee-categories/route.ts` — admin guard
- `src/app/api/biz/company/employee-categories/[id]/route.ts` — admin guard
- `src/app/api/biz/jobs/route.ts` — admin guard
- `src/app/api/biz/jobs/[id]/route.ts` — admin guard + リファクタリング

---

## 残課題・補足

- **autosave (PUT /api/biz/company)**: member もフォーム編集はできるが、自動保存が 403 になる。UX として「閲覧のみ」とするか、member でも draft 保存可にするかは今後の設計次第。現状は「保存試みて失敗」になる点を考慮し、将来的にはフォーム自体を `readOnly` にする対応も検討。
- **`/biz/meetings`**: 未実装のため権限ガードも未着手。実装時に同パターンで追加する。
- **`/biz/analytics`**: 同上。
