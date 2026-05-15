# Stage 1 調査レポート: PR-β Phase 4 — biz/auth 多段フォームのジャンル統合

**調査日**: 2026-05-17  
**対象ファイル**: `src/app/biz/auth/page.tsx`（単一ファイル 1,200行超）  
**Phase 4 実装依頼書**: `docs/implementation-request-pr-beta-phase4.md`

---

## 1. biz/auth/page.tsx の全体構造

### Server Component / Client Component の境界

```
src/app/biz/auth/page.tsx
└── "use client"（ファイル全体）
    ├── BizAuthPage（Suspense ラッパー、export default）
    └── BizAuthInner（メインロジック）
        ├── BrandPanel（左パネル: ブランドイメージ）
        └── FormSide（右パネル: フォーム表示）
            ├── ModeTabBar（新規登録/ログイン タブ切替）
            ├── SignupForm（mode === "signup" のとき表示）
            └── LoginForm（mode === "login" のとき表示）
```

**⚠️ 重要: 全体が `"use client"`**

Server Component の親ページが存在しない（`useSearchParams()` 使用のため Suspense が必要で、`"use client"` にせざるを得ない構造）。

これにより、**Phase 2/3 で使ったパターン「Server Component で ow_genres を取得 → props で渡す」が直接適用できない**。

### 「多段フォーム」の実態

実装依頼書で「多段フォーム」と記載されているが、実際には **2モードの切り替え（タブ UI）**。  
ステップ数は実質 **1ステップ**（1画面にすべての入力フィールドが並ぶ）:

| フィールド | 通常フロー | invite フロー |
|-----------|-----------|-------------|
| 企業名 | ✅ 表示 | ❌ 非表示 |
| 業種 | ✅ 表示 | ❌ 非表示 |
| 従業員数 | ✅ 表示 | ❌ 非表示 |
| ご担当者のお名前 | ✅ 表示 | ✅ 表示 |
| 部署・役職 | ✅ 表示 | ✅ 表示 |
| メールアドレス | ✅ 表示 | ✅ 表示（招待メアドをプリフィル） |
| パスワード | ✅ 表示 | ✅ 表示 |
| 利用規約同意 | ✅ 表示 | ✅ 表示 |

**ジャンル選択を追加すべき位置**: 企業名・業種・従業員数の `!isInviteMode` ガード内（L712〜764）、業種/従業員数グリッドの直下。Phase 2/3 と同じ配置パターン。

### 通常フローと invite フローの分岐

```typescript
// L67: URL パラメータ ?context=invite で判定
const isInviteContext = searchParams.get("context") === "invite";

// SignupForm 内 (L521)
const isInviteMode = inviteContext !== null;

// L711-764: 企業情報入力フィールドは !isInviteMode のとき表示
{!isInviteMode && (
  <>
    {/* 企業名・業種・従業員数 + ← ここにジャンルを追加 */}
  </>
)}
```

---

## 2. PendingCompany のスキーマ

### 型定義（L10-14）

```typescript
type PendingCompany = {
  name: string;
  industry: string;
  employeeCount: string;
};
const PENDING_COMPANY_KEY = "opinio_biz_pending_company";
```

**genres フィールドは存在しない**（Phase 4 で追加が必要）。

### PendingCompany を読み書きしているファイル

`grep -rn "PendingCompany\|opinio_biz_pending"` の結果:

**書き込みファイル: 1件のみ**

| ファイル | 行 | 内容 |
|---------|---|------|
| `src/app/biz/auth/page.tsx` | L588-589 | SignupForm.handleSubmit — 既存メアドのとき sessionStorage に退避 |

**読み込みファイル: 1件のみ**

| ファイル | 行 | 内容 |
|---------|---|------|
| `src/app/biz/auth/page.tsx` | L81-84 | BizAuthInner の useEffect — マウント時に残留データを読み込み |
|  | L114-115 | handleSwitchToLogin — signup→login 切替時に再読み込み |
|  | L1032-1039 | LoginForm.handleSubmit — stored として企業作成に使用 |

**結論**: `PendingCompany` は `biz/auth/page.tsx` 内のみで閉じた型定義。他ファイルへの波及なし。

---

## 3. 「handleAfterAuth()」の実態

実装依頼書で `handleAfterAuth()` と記述されているが、**実際のコードにこの名前の関数は存在しない**。企業作成処理は各フォームの `handleSubmit` 内で行われており、2か所に分散している。

### 企業作成フロー — 2経路

#### 経路 A: SignupForm.handleSubmit（新規ユーザー）

```typescript
// L628-648 — 通常モード（isInviteMode === false の場合のみ実行）
const res = await fetch("/api/company/register", {
  method: "POST",
  body: JSON.stringify({
    name: companyName,
    industry,
    employee_count: employeeCount,
    department: contactTitle,
    role_title: contactTitle,
  }),
});
// → window.location.replace(next || "/biz/dashboard")
```

**`/api/company/register`**: Phase 3 で拡張した `/api/biz/companies` とは**別の API ルート**。genres 未対応。

#### 経路 B: LoginForm.handleSubmit（既存ユーザーがログイン後に PendingCompany を復元）

```typescript
// L1042-1063
if (stored) {
  await fetch("/api/biz/companies", {
    method: "POST",
    body: JSON.stringify({
      name: stored.name,
      industry: stored.industry || null,
      // employeeCount は送られていない
    }),
  });
  // → window.location.replace(next || "/biz/dashboard")
}
```

**`/api/biz/companies`**: Phase 3 で genres 対応済み。ただし現在 `genres` を送っていない。

---

## 4. ジャンル選択 UI を入れるステップの特定

### 挿入位置（SignupForm 内、L727-763 の直後）

```tsx
{!isInviteMode && (
  <>
    {/* 企業名 (L713-726) */}
    <div style={{ marginBottom: 16 }}>
      <FieldLabel label="企業名" required />
      <input ... />
    </div>

    {/* 業種 + 従業員数グリッド (L727-763) */}
    <div className="biz-form-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <select /* 業種 */ />
      <select /* 従業員数 */ />
    </div>

    {/* ← ここにジャンル選択 UI を追加（L764 の直前） */}
  </>
)}
```

`!isInviteMode` ガードの中にあるため、**invite フロー時は自動的に非表示**になる（追加の条件分岐不要）。

---

## 5. 影響範囲ファイル一覧

### 確実に修正が必要なファイル

| ファイル | 修正概要 |
|---------|---------|
| `src/app/biz/auth/page.tsx` | ① PendingCompany 型に `genres: string[]` 追加、② `genres` state 追加（SignupForm 内）、③ GenreChipSelector 追加（企業情報セクション内）、④ 経路A の POST body に genres 追加、⑤ 経路B の stored → POST body に genres を含める |
| `src/app/api/company/register/route.ts` | genres（slug 配列）を受け取り、ow_company_genres に best-effort INSERT（経路A 向け） |

### 修正不要なファイル

| ファイル | 理由 |
|---------|------|
| `src/app/api/biz/companies/route.ts` | Phase 3 で genres 対応済み（経路B はそのまま使える） |
| `src/components/ui/GenreChipSelector.tsx` | Phase 1 で作成済み、変更不要 |
| invite 関連ファイル | 論点①: 触らない |

---

## 6. ジャンル一覧の取得方法（重要な相違点）

Phase 2/3: Server Component で `ow_genres` を取得 → Client Component に props で渡す

**Phase 4 ではこのパターンが使えない**。`biz/auth/page.tsx` 全体が `"use client"` であり、Server Component 親が存在しないため。

**代替案 2つ**:

### 案 X: `useEffect` + Supabase client で取得（クライアントサイド）

```typescript
// SignupForm 内に追加
const [availableGenres, setAvailableGenres] = useState<Genre[]>([]);

useEffect(() => {
  const supabase = createClient();
  supabase
    .from("ow_genres")
    .select("slug, name, display_order")
    .eq("is_active", true)
    .order("display_order")
    .then(({ data }) => setAvailableGenres((data ?? []) as Genre[]));
}, []);
```

- メリット: 既存の `"use client"` 構造を変えない、実装がシンプル
- デメリット: クライアントサイドで DB クエリが走る（ネットワーク 1往復）、初期表示に一瞬のチラつきがあり得る
- セキュリティ: `ow_genres` は公開データなので問題なし

### 案 Y: `page.tsx` を Server Component に変換する

現状 `"use client"` の理由は `useSearchParams()` の使用。これを `Suspense` でラップして Server Component から渡す構造に変えると genres を props で渡せる。ただし、大規模なリファクタリングが必要。

**Phase 4 での推奨**: 案 X（useEffect）。変更量が最小で、リスクが低い。

---

## 7. 実装難所まとめ

| 難所 | 内容 | 対応方針 |
|-----|------|---------|
| 全体 "use client" | Server Component パターン不可 | useEffect で ow_genres 取得（案 X） |
| 2つの API ルート | 経路A（`/api/company/register`）は genres 未対応 | register route に genres INSERT 追加 |
| PendingCompany の genres 引き継ぎ | sessionStorage → LoginForm → POST body まで genres を通す | stored.genres を POST に含める |
| ファイルが 1,200行超の単一ファイル | 変更箇所が多い | 既存スタイルに合わせて最小限の変更 |

---

## Hisato さん + Claude への質問

### Q1. `/api/company/register` にも genres を追加するか ✅要確認

実装依頼書（論点②）では「新規 API は作らない」とあるが、**既存 `/api/company/register` への genres 追加は論点②の対象外**（新規作成ではなく既存ルートの拡張）。

経路A（SignupForm → `/api/company/register`）を使う場合、このルートにも genres INSERT ロジックを追加する必要がある。

→ **確認**: `/api/company/register` に genres INSERT を追加する方針でよいか？

### Q2. genres 取得方法: 案 X（useEffect）で進めるか

`"use client"` 全体の制約により、useEffect + Supabase client での取得を推奨。  
→ **確認**: 案 X（useEffect）で進めてよいか？

### Q3. ow_genres チップ表示の初期ローディング

useEffect で取得する場合、フォーム表示直後はチップが表示されない（1秒未満の想定）。  
これを許容するか、スケルトン表示（8個の灰色チップ）を入れるか？  
→ **シンプルさ優先**で、取得後に表示される形（ローディング中はチップ非表示）で構わないか確認。

---

## Stage 2 実装前チェックリスト

1. ✅ Q1（register route への genres 追加）の回答
2. ✅ Q2（useEffect パターン採用）の承認
3. ✅ Q3（初期ローディング挙動）の方針確認
4. 上記確認後、Stage 2（実装）の着手許可
