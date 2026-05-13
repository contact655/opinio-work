# Debug: Sprint 3 運営通知メール未送信の原因調査

調査日: 2026-05-13  
症状: 「テスト商事_20260513_1」作成後、ADMIN_EMAIL に通知メールが届かない。Resend ダッシュボードにもログなし。

---

## 結論（TL;DR）

**原因は 2 つあり、メインは「コード未デプロイ」。**

| 優先度 | 原因 | 影響 |
|--------|------|------|
| 🔴 Primary | **Sprint 1〜3 のコード（7 commits）が GitHub/Vercel に push されていない** | 運営通知どころか `/api/biz/companies` 自体が本番に存在しない |
| 🟡 Secondary | **`sendEmail()` が Resend API エラーを throw しない** | push 後も `emailSent` フラグの信頼性が低い（ただし通知は届く） |

---

## 調査詳細

### 1. git 状態の確認

```
$ git status
On branch main
Your branch is ahead of 'origin/main' by 7 commits.
```

**本番デプロイ済みの最新コミット（origin/main HEAD）**: `e486f2a`  
→ Phase 2 実装前の「Phase 2 事前調査レポート追加」まで

**ローカルのみに存在する 7 commits**:
```
a9deb0c  docs: Phase 2 Sprint 3 handover document
d09c506  feat(notify): Phase 2 Sprint 3 — email notifications for invite and company creation
e55c097  docs: Sprint 3 pre-research report on email notification infrastructure
8d8b7c9  docs: Phase 2 Sprint 2 handover document
d558e87  feat(ui): Phase 2 Sprint 2 — 3 UI implementations for self-serve onboarding
4c089ad  docs: Phase 2 Sprint 1 handover document
c0f2d0e  feat(api): Phase 2 Sprint 1 — 3 backend API routes for self-serve onboarding
```

→ **Sprint 3 のメール送信コードは本番に一切存在しない。**

---

### 2. Vercel ランタイムログの確認

```
17:01:36.48  opinio.jp  info  ε POST /api/company/register  200
```

本番で企業作成時に呼ばれているのは **旧エンドポイント `/api/company/register`**。  
Sprint 1 で新設した `/api/biz/companies` は `origin/main` に存在しない：

```
$ git ls-tree --name-only origin/main src/app/api/biz/
applications
company         ← /biz/company（企業情報編集）
conversations
jobs
meetings
members
switch-company
                ← "companies" が存在しない！
```

つまり：
- Sprint 2 の UI（`CreateCompanyClient.tsx`）は未デプロイ → 本番 UI は旧エンドポイントを呼んでいる
- Sprint 3 のメール追加コードも未デプロイ
- `テスト商事_20260513_1` は旧エンドポイント `/api/company/register` 経由で作成された

---

### 3. `/api/company/register`（旧エンドポイント）の確認

```typescript
// origin/main の /api/company/register/route.ts
export async function POST(req: Request) {
  // 認証 → body 取得 → INSERT → 200 返却
  // ← メール送信処理は一切なし
}
```

旧エンドポイントには通知コードがなく、送信されるはずがない。

---

### 4. Sprint 3 コード自体の品質確認

Sprint 3 で追加したコード（`/api/biz/companies/route.ts`）は論理的には正しい：

```typescript
// ✅ インポート: 正しい
import { sendEmail } from "@/lib/notify/email";
import { newCompanyAdminTemplate } from "@/lib/notify/templates";

// ✅ 送信タイミング: INSERT 成功後
// ✅ best-effort: try/catch あり
// ✅ isDuplicate: force_create を正しく参照
// ✅ creatorName: owUser?.name ?? user.email ?? "不明" のフォールバックあり
try {
  await sendEmail(
    newCompanyAdminTemplate({
      companyName: company.name,
      companyId: company.id,
      creatorName: owUser?.name ?? user.email ?? "不明",
      creatorEmail: user.email ?? "",
      createdAt: company.created_at,
      isDuplicate: body.force_create ?? false,
    })
  );
} catch (err) {
  console.error("[POST /api/biz/companies] admin notify failed:", err);
}
```

コード自体に論理バグはない。push すれば動作するはず。

---

### 5. Secondary Bug: `sendEmail()` が Resend API エラーを throw しない

```typescript
// src/lib/notify/email.ts
export async function sendEmail(params: EmailParams): Promise<void> {
  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({ ... });

  if (error) {
    console.error("[notify] sendEmail error:", error);
    // ← throw していない！ 正常 return する
  }
}
```

**問題**: Resend SDK は失敗時に例外を throw せず `{ data, error }` を返す設計。  
現在の実装は `error` を console.error するだけで return するため：

- `invite/route.ts` の `emailSent` フラグが誤検知する可能性：
  ```typescript
  try {
    await sendEmail(...);  // Resend エラーでも throw されない
    emailSent = true;      // ← Resend エラーでも true になってしまう
  } catch (err) {
    // ← catch されない
    emailSent = false;     // ← 到達しない
  }
  ```

- `companies/route.ts` は best-effort（`emailSent` なし）なので実害は小さいが、  
  Resend エラーが catch されない → ログが2重に残る（sendEmail 内 + catch なし）

---

## 修正案

### Fix 1（必須）: push → デプロイ

```bash
git push origin main
```

Vercel が GitHub 連携で自動デプロイ。  
`/api/biz/companies` が本番に展開され、メール送信コードが有効になる。

**push 前の確認チェックリスト**:
- [ ] Sprint 1: `/api/biz/companies`, `/api/biz/members/invite`, etc.
- [ ] Sprint 2: `CreateCompanyClient.tsx`（新 UI）、`Header.tsx`
- [ ] Sprint 3: メール送信コード（`templates.ts`, `invite/route.ts`, `companies/route.ts`）
- [ ] Vercel 環境変数: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_EMAIL` が Production に設定済みであること

### Fix 2（推奨）: `sendEmail()` を Resend エラーでも throw するように修正

```typescript
// src/lib/notify/email.ts（修正案）
export async function sendEmail(params: EmailParams): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log("[notify] sendEmail (mock):", { ... });
    return;
  }

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({ ... });

  if (error) {
    console.error("[notify] sendEmail error:", error);
    throw new Error(`Resend error: ${error.message}`);  // ← throw を追加
  }
}
```

これにより:
- `emailSent = false` が正しく機能する
- `companies/route.ts` の catch が Resend API エラーも捕捉できる

---

## 環境変数の経路確認

```typescript
// templates.ts
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "hshiba@opinio.co.jp";
//                                              ↑ フォールバックは旧メアド
```

Vercel に `ADMIN_EMAIL=s.hisato1020@gmail.com` が設定済みであれば、  
`process.env.ADMIN_EMAIL` がその値を返す（モジュール初期化時に評価）。  
**環境変数が正しく設定されていれば、フォールバックには到達しない。**

```typescript
// email.ts
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// ← モジュールレベルで評価
// Next.js の API Route では serverless コールドスタート時に env var が利用可能
// → 問題なし
```

---

## 再現手順（push 後の正常系確認）

1. `git push origin main` → Vercel デプロイ完了を確認
2. biz002 で `/biz/companies/add/new/` から新企業を作成
3. Vercel ログで `POST /api/biz/companies` が呼ばれることを確認（旧 `/api/company/register` ではないこと）
4. `s.hisato1020@gmail.com` に通知メールが届くことを確認
5. Resend ダッシュボードにログが出ることを確認

---

**作成者**: Claude Code  
**作成日**: 2026-05-13
