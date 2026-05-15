# 実装指示: PR-β Phase 4 Stage 2 着手

Stage 1 レポート（`docs/research-2026-05-17-pr-beta-phase4-biz-auth.md`、コミット `14b5564`）
を Hisato が確認しました。以下の判断で Stage 2 を実装してください。

## Stage 1 で発覚した重要事項の確認

### 前提変更①: Server Component パターン不可

`biz/auth/page.tsx` は `useSearchParams()` の制約で全体が "use client"。
当初の依頼文に書いた「Server Component で ow_genres を取得 → props 渡し」パターンは **使えない**。

**対応**: クライアント側で `useEffect + createClient()` で取得。

### 前提変更②: 企業作成 API が2ルート

| 経路 | 対象 | API ルート | 現状 |
|---|---|---|---|
| 経路A | 新規ユーザー（SignupForm） | `/api/company/register` | **genres 未対応** |
| 経路B | 既存ユーザー（LoginForm + PendingCompany） | `/api/biz/companies` | Phase 3 で対応済み |

**対応**: 経路Aの `/api/company/register` にも genres 対応を追加（後述）。

### 前提変更③: 「多段フォーム」は実際は 1 ステップ

`!isInviteMode` ガード内の企業情報セクション（企業名・業種・従業員数グリッドの直下）に配置。

## Hisato の判断（Q1〜Q3）

- **Q1**: `/api/company/register` にも genres INSERT を追加 → **Yes**
- **Q2**: ow_genres 取得に useEffect を使う → **Yes**
- **Q3**: ロード中の表示 → **方式X（何も表示しない、取得後に表示）**

### Q3 の補足

- 「ジャンル」見出しは先に出しておく
- 見出しの下のチップエリアだけ後から埋まる形にする
- 見出しごと突然現れると DOM がジャンプして UX が悪い

## Stage 2 のスコープ

### 触るファイル

1. **`src/app/biz/auth/page.tsx`**（Client Component、"use client" のまま）
   - `useState<Genre[]>` で availableGenres を管理
   - `useEffect` で ow_genres を取得（is_active=true, display_order 昇順）
   - `!isInviteMode` ガード内の企業情報セクションに GenreChipSelector 配置
   - フォーム state に `genres: string[]` を追加（デフォルト `[]`）
   - SignupForm / LoginForm への渡し方は Stage 1 調査結果に従う

2. **PendingCompany 型定義**（場所は Stage 1 で特定済み）
   - `genres: string[]` を追加（オプショナルではなく、デフォルト `[]`）

3. **handleAfterAuth()**（場所は Stage 1 で特定済み）
   - PendingCompany から genres を取り出して POST body に含める
   - POST 先: `/api/biz/companies`（Phase 3 で対応済み）

4. **SignupForm**（経路A）
   - 企業作成時の POST body に genres を含める
   - POST 先: `/api/company/register`

5. **`src/app/api/company/register/route.ts`**（経路Aの API）
   - body 型に `genres?: string[]` を追加（オプショナル）
   - ow_companies INSERT 成功後、ow_company_genres INSERT（best-effort）
   - Phase 3 の `/api/biz/companies` POST と同じパターン:
     - slug → genre_id 解決
     - 不正 slug は警告ログで無視
     - INSERT 失敗はログのみ、レスポンスは成功扱い
     - genres を ow_companies INSERT から除外（spread から外す）

### 触らないファイル

- invite フローのコード（論点①: 既存企業参加なので不要）
- `/api/biz/companies` POST handler（Phase 3 で対応済み、変更不要）
- CompanyEditClient / CreateCompanyClient / admin（Phase 2/3 で完了、または方式②で当面そのまま）

## 実装ガイド

### 1. ow_genres のクライアント側取得

```typescript
// biz/auth/page.tsx 内
const [availableGenres, setAvailableGenres] = useState<Array<{
  slug: string;
  name: string;
  display_order: number;
}>>([]);

useEffect(() => {
  const fetchGenres = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('ow_genres')
      .select('slug, name, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    setAvailableGenres(data ?? []);
  };
  fetchGenres();
}, []);
```

### 2. UI 配置（Q3 方式X）

```tsx
{!isInviteMode && (
  <>
    {/* 既存の企業名・業種・従業員数グリッド */}
    
    <div className="mt-6">
      <label className="...">ジャンル</label>
      <p className="text-xs text-muted">該当するジャンルを選択してください（任意・複数選択可）。</p>
      
      {/* ロード中は何も表示しない、取得後にチップ群が現れる */}
      {availableGenres.length > 0 && (
        <GenreChipSelector
          genres={availableGenres}
          selected={genres}
          onChange={setGenres}
        />
      )}
    </div>
  </>
)}
```

### 3. PendingCompany 拡張

```typescript
type PendingCompany = {
  // ... 既存フィールド
  genres: string[]; // slug 配列、デフォルト []
};
```

sessionStorage に保存する際は `genres: genres ?? []` で必ず配列にする。

### 4. handleAfterAuth() の genres 引き渡し

```typescript
const pending = JSON.parse(sessionStorage.getItem("pendingCompany") ?? "{}");

const response = await fetch("/api/biz/companies", {
  method: "POST",
  body: JSON.stringify({
    // ... 既存フィールド
    genres: pending.genres ?? [],
  }),
});
```

### 5. SignupForm 経路の POST body

```typescript
const response = await fetch("/api/company/register", {
  method: "POST",
  body: JSON.stringify({
    // ... 既存フィールド
    genres, // SignupForm の state から
  }),
});
```

### 6. `/api/company/register` の拡張（Phase 3 と同パターン）

```typescript
// body から genres を分離
const { genres: genreSlugs = [], ...companyData } = body;

// ow_companies INSERT（既存処理、companyData のみ）
const { data: newCompany, error } = await supabase
  .from('ow_companies')
  .insert(companyData)
  .select()
  .single();

if (error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
}

// genres INSERT（best-effort）
if (genreSlugs.length > 0) {
  const { data: genreRecords } = await supabase
    .from('ow_genres')
    .select('id, slug')
    .in('slug', genreSlugs);

  const genreIds = genreRecords?.map(g => g.id) ?? [];

  const missingSlugs = genreSlugs.filter(s => !genreRecords?.find(r => r.slug === s));
  if (missingSlugs.length > 0) {
    console.warn(`[company/register POST] Invalid genre slugs ignored: ${missingSlugs.join(', ')}`);
  }

  if (genreIds.length > 0) {
    const { error: genresError } = await supabase
      .from('ow_company_genres')
      .insert(
        genreIds.map(genre_id => ({ company_id: newCompany.id, genre_id }))
      );
    
    if (genresError) {
      console.error(`[company/register POST] Failed to insert ow_company_genres for company ${newCompany.id}:`, genresError);
    }
  }
}

return NextResponse.json({ company: newCompany }, { status: 201 });
```

## 受け入れ基準

1. 通常フロー（経路B: 既存ユーザー）でジャンルチップ8個が表示される
2. 通常フロー（経路A: 新規ユーザー / SignupForm）でジャンルチップ8個が表示される
3. invite フローではジャンル UI が表示されない
4. ジャンル選択状態が認証フロー中も保持される（sessionStorage 経由）
5. 経路A（新規ユーザー）で企業作成 → ow_company_genres に正しく INSERT
6. 経路B（既存ユーザー）で企業作成 → ow_company_genres に正しく INSERT
7. ジャンル未選択（0件）でも認証・企業作成が成功する
8. ロード中はチップエリアが空、見出しのみ表示（DOM ジャンプなし）
9. 既存のフローに regression がない（通常フロー・invite フロー両方）
10. `npm run build` 通過
11. `git push origin main` までセット
12. Vercel デプロイ確認

## やらないこと（明示）

- invite フローのコード修正
- 共通コンポーネント `GenreChipSelector` 自体の修正
- CompanyEditClient / CreateCompanyClient / admin のコード修正

## コミットメッセージ案

```
feat: integrate GenreChipSelector into biz/auth flow (PR-β Phase 4 Stage 2)

- Add genres state to biz/auth/page.tsx (client-side ow_genres fetch via useEffect)
- GenreChipSelector shown in normal flow only (!isInviteMode)
- Invite flow remains unchanged
- PendingCompany schema extended with genres: string[]
- handleAfterAuth passes genres to POST /api/biz/companies (route B, already supports)
- SignupForm passes genres to POST /api/company/register (route A, NEW support)
- /api/company/register handler inserts ow_company_genres after ow_companies INSERT
- Best-effort: ow_company_genres failure does not block company creation
- Loading: chips appear after fetch completes, heading shown immediately (no DOM jump)
- Completes PR-β series: company genre management across all 4 entry points
```

## 完了後の報告事項

1. コミット hash
2. Vercel デプロイ完了確認
3. 動作確認シナリオ:
   - 経路A（新規ユーザー / SignupForm）: ジャンル選択 → 認証 → 企業作成 → DB 反映
   - 経路B（既存ユーザー / LoginForm + PendingCompany）: 同上
   - invite フロー: ジャンル UI が出ないこと
   - ジャンル0件で経路A・B 両方を完了
4. ロード中の UX 確認（DOM ジャンプなし）
5. PR-β 全体の総括（Phase 1-4 の合算で何ファイル / 何行 / どんな価値が達成されたか）

## 重要: 既存運用ルールの遵守

- `npm run build` 必須
- `git push origin main` 必ず実行（commit hash で Vercel deployments 目視確認）
- 経路A と経路B 両方の動作確認をすること（片方だけだと regression を見落とす）
