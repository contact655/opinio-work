# 実装確認レポート — 登録フロー再設計（人と企業の概念分離）

**実装日**: 2026-05-14  
**コミット**: e761531  
**PR/Branch**: main 直コミット  
**ビルド**: ✅ `npm run build` 成功（TypeScript エラー 0 件）

---

## 背景・設計思想

従来の `/biz/auth` は「ユーザー登録 ≈ 企業登録」と暗黙に一致していた。
しかし **North Star: ow_users は常にキャリアを持つ個人であり、企業作成はその個人が行う操作** という方針に沿い、
以下の課題を解消する再設計を実施した。

| 課題 | 改善後 |
|------|--------|
| 既存個人ユーザーが企業を作ろうとすると「メールが既に登録済み」でブロックされる | 自動的にログインタブへ切り替え、ログイン後に企業作成を続行 |
| テナントなし状態で `/biz/companies/add/new` に直接アクセスすると空白 or リダイレクト | テナントなしでも企業作成フォームを表示 |
| ログイン済みユーザーが `/biz/auth` に来るとダッシュボードへ一律リダイレクト | 企業未所属なら `/biz/companies/add/new` へ誘導 |
| LP の CTA が常に `/biz/auth` | ログイン済み+企業所属なら `/biz/dashboard`、企業未所属なら `/biz/companies/add/new` へ |
| CompanySwitcher に「新しい企業を作成」がなかった | ドロップダウンのフッターに追加（1社でもドロップダウンを表示） |

---

## 実装ファイル一覧

| ファイル | 変更規模 | Phase |
|---------|---------|-------|
| `src/app/biz/auth/page.tsx` | 大規模（+280行） | 1・2・5 |
| `src/app/biz/companies/add/new/page.tsx` | 中規模（ +30行） | 3 |
| `src/app/biz/companies/add/new/CreateCompanyClient.tsx` | 中規模（+120行） | 3 |
| `src/components/business/CompanySwitcher.tsx` | 小規模（+20行） | 4 |
| `src/app/business/page.tsx` | 小規模（+20行） | 5 |

---

## Phase 別詳細

### Phase 1: 既存メアド自動検出 → ログインタブ切替

**ファイル**: `src/app/biz/auth/page.tsx` — `SignupForm.handleSubmit`

```typescript
// supabase.auth.signUp が "already registered" エラーを返したとき
if (authError.message.includes("already registered") || authError.message.includes("User already registered")) {
  // 企業情報を sessionStorage に保存
  sessionStorage.setItem(PENDING_COMPANY_KEY, JSON.stringify({ name: companyName, industry, employeeCount }));
  // ログインタブへ自動切り替え（メアドを prefill）
  onSwitchToLogin(email);
  return;
}
```

**UX**: エラーメッセージを表示せず自動切替。ログインタブには「既にアカウントがあります。ログインして企業を作成しましょう。」バナーを表示。

---

### Phase 2: sessionStorage 引き継ぎ → ログイン後に企業作成

**ファイル**: `src/app/biz/auth/page.tsx` — `LoginForm.handleSubmit`

```typescript
// ログイン成功後
let stored = pendingCompany; // prop or sessionStorage fallback
if (!stored) {
  const raw = sessionStorage.getItem(PENDING_COMPANY_KEY);
  if (raw) stored = JSON.parse(raw);
}
if (stored) {
  // API Route で企業を作成
  await fetch("/api/biz/companies", { method: "POST", body: JSON.stringify({ name: stored.name, industry: stored.industry }) });
  sessionStorage.removeItem(PENDING_COMPANY_KEY);
  window.location.replace(next || "/biz/dashboard");
  return;
}
router.replace(next);
```

**PendingCompany型**:
```typescript
type PendingCompany = { name: string; industry: string; employeeCount: string; };
const PENDING_COMPANY_KEY = "opinio_biz_pending_company";
```

---

### Phase 3: テナントなし状態でも企業作成フォームを表示 + ユーザーバッジ

**ファイル**: `src/app/biz/companies/add/new/page.tsx`

```typescript
// getTenantContext() が null でもフォームを表示（従来は別コンテンツを表示していた）
if (!ctx) {
  return (
    <BusinessLayout userName={userBadge?.name ?? "ご担当者"}>
      <CreateCompanyClient userBadge={userBadge} />
    </BusinessLayout>
  );
}
```

**ファイル**: `src/app/biz/companies/add/new/CreateCompanyClient.tsx`

- フォーム上部に「○○さん (email) のアカウントで企業を作成します」バッジを追加
- 「別のアカウントを使う」ボタン → 確認モーダル → `supabase.auth.signOut()` → `/biz/auth` へリダイレクト

---

### Phase 4: CompanySwitcher に「新しい企業を作成」追加

**ファイル**: `src/components/business/CompanySwitcher.tsx`

- `memberships.length <= 1` で短絡していた分岐を削除 → 常にドロップダウンを表示
- フッターアクションの先頭に「＋ 新しい企業を作成」(`/biz/companies/add/new`) を追加
- 既存「別の会社に参加」「企業情報を設定」はその後に配置

---

### Phase 5: LP の auth-aware CTA ルーティング

**ファイル**: `src/app/business/page.tsx`

```typescript
export const dynamic = "force-dynamic";

export default async function ForCompaniesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let bizCtaHref = "/biz/auth";
  if (user) {
    const { data: memberships } = await supabase
      .from("ow_company_admins").select("id").limit(1);
    bizCtaHref = (memberships?.length ?? 0) > 0 ? "/biz/dashboard" : "/biz/companies/add/new";
  }
  // ... CTA Link href={bizCtaHref}
}
```

---

## 検証シナリオ

### シナリオ1: 完全新規ユーザーが企業作成（ゴールデンパス）

```
/business → 「無料で始める」CTA
→ /biz/auth (signup tab)
→ 会社名・業種・メアド・パスワード入力
→ signUp 成功 → メール認証リンク（Supabase が自動送信）
→ 認証後 → /biz/dashboard（または /biz/companies/add/new にリダイレクト）
```

**確認ポイント**: Supabase Auth にユーザーが作成されること

---

### シナリオ2: 既存個人ユーザーが企業作成（Phase 1+2 の核心）

```
/business → 「無料で始める」
→ /biz/auth (signup tab)
→ 会社名・業種を入力し、既存メアドで signUp 試みる
→ "already registered" エラーを検出
→ ログインタブへ自動切替（メアド prefill、pendingCompany バナー表示）
→ パスワードを入力してログイン
→ ログイン成功後、/api/biz/companies に POST して企業作成
→ /biz/dashboard へリダイレクト
```

**確認ポイント**: `ow_company_admins` に新しいレコードが作成されていること

---

### シナリオ3: ログイン中ユーザーが企業追加

```
/biz/dashboard (会社Aでログイン中)
→ CompanySwitcher ドロップダウンを開く
→「新しい企業を作成」をクリック
→ /biz/companies/add/new（ユーザーバッジ表示、テナントあり）
→ 会社名・業種を入力して送信
→ /biz/dashboard へリダイレクト（新しい会社が選択された状態）
```

**確認ポイント**: CompanySwitcherに新会社が表示されること

---

### シナリオ4: 別アカウントへの切替

```
/biz/companies/add/new（ユーザーバッジ表示中）
→「別のアカウントを使う」をクリック
→ 確認モーダル表示「ログアウトして新規登録ページへ移動します」
→「ログアウトして新規登録へ」をクリック
→ supabase.auth.signOut() 実行
→ /biz/auth へリダイレクト（signup tab）
```

**確認ポイント**: セッションがクリアされること

---

## 制約・スコープ外

| 項目 | 状態 | 理由 |
|------|------|------|
| メール認証後のリダイレクト先 | 未変更（Supabase デフォルト） | Phase 5 Stage 2 スコープ |
| `/api/biz/companies` POST | 既存 API を再利用 | 今回はルーティング層のみ改修 |
| orphan ow_users 210件の削除 | 未実施 | 改めて依頼予定 |
| 招待機能 | 未実装 | /biz/members 実装時に対応 |

---

## 技術的注意事項

- **sessionStorage の寿命**: タブを閉じるとクリアされる。ブラウザリロードには耐える。
- **window.location.replace vs router.replace**: pendingCompany がある場合はフルページリロードが必要（App Router キャッシュバイパスのため）。
- **best-effort company creation**: `/api/biz/companies` POST の失敗はログのみ（ユーザーのログイン自体はブロックしない）。
- **PG15+ RLS**: ow_company_admins の SELECT は auth_is_company_member() 経由（migration 037 済み）。

---

## 関連ファイル・ドキュメント

- 調査レポート: `docs/investigation-2026-05-15-signup-flow.md`
- API Route: `src/app/api/biz/companies/route.ts`
- RLS migration: `supabase/migrations/037_*.sql`
