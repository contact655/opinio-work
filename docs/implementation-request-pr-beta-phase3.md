# 実装依頼: PR-β Phase 3 — CreateCompanyClient へのジャンル統合

## 背景

PR-β（企業作成/編集フォームのジャンル化）の Phase 3。
Phase 1 で共通コンポーネント作成済み（コミット `12ebb2d`）、Phase 2 で CompanyEditClient 統合済み（コミット `4917ff6`、動作確認 OK）。

事前調査レポート: `docs/research-2026-05-17-pr-beta-company-form-genres.md`
Phase 1 実装依頼書: `docs/implementation-request-pr-beta-phase1.md`
Phase 2 実装依頼書: `docs/implementation-request-pr-beta-phase2.md`

## Phase 2 との違い（必読）

| 項目 | Phase 2 (B: CompanyEditClient) | Phase 3 (C: CreateCompanyClient) |
|---|---|---|
| 保存方式 | autosave + draft_data | **一発 POST**（autosave なし） |
| draft_data 経由 | あり | **なし**（直接 ow_companies INSERT） |
| 公開タイミング | 「変更を公開する」ボタン | **作成と同時に公開** |
| ow_company_genres 反映 | PATCH handler（DELETE→INSERT） | **作成後 INSERT のみ**（既存なし） |
| state 管理 | 既存の autosave フックに乗せる | **コンポーネント内 useState** |

Phase 3 は autosave なし。フォーム送信時に1回の POST で完結する。

## Phase 3 のスコープ

### 触るファイル（想定）

1. `src/app/biz/companies/add/new/page.tsx`（Server Component） — ow_genres 全件取得 + props 渡し追加
2. `src/app/biz/companies/add/new/CreateCompanyClient.tsx` — GenreChipSelector の組み込み、state 管理、POST ペイロードへの genres 追加
3. `src/app/api/biz/companies/route.ts`（または該当する POST handler） — 作成後の ow_company_genres INSERT 追加

※ 上記は想定。実際のファイルパスは事前調査結果に従ってください。

### 触らないファイル
- `src/app/biz/auth/page.tsx`（Phase 4 で扱う）
- `src/app/biz/company/CompanyEditClient.tsx`（Phase 2 で完了）
- `src/app/admin/companies/[id]/CompanyDetailClient.tsx`（方式②: 触らない）

## 確定済み方針（再掲・必読）

- **データ保持**: slug 配列（id ではない）
- **作成 API の単一トランザクション化**: **方式P**（POST `/api/biz/companies` を拡張して genres も一緒に受け取り、サーバー側で ow_companies INSERT → ow_company_genres INSERT を連続実行）
- **ow_company_genres 同期失敗時の挙動**: best-effort。ow_companies の INSERT は成功済みなら 201/200 を返す（Phase 2 と同じ運用）。ただし企業本体の INSERT 失敗時は通常通り 500
- **UI**: チップ群（Phase 1/2 と同じ `GenreChipSelector` を使い回し）
- **配置位置**: Claude Code 側で適切なセクションを判断（Phase 2 と同じ「業種・フェーズ」グリッドの近辺が候補だが、実装側で判断）
- **必須/任意**: 任意（0件でも作成可能）、複数選択可、上限なし

## 詳細仕様

### 1. Server Component（page.tsx）でのデータ取得

`src/app/biz/companies/add/new/page.tsx`:

```typescript
const { data: genres } = await supabase
  .from('ow_genres')
  .select('slug, name, display_order')
  .eq('is_active', true)
  .order('display_order', { ascending: true });
```

取得した `genres` を `CreateCompanyClient` に props で渡す。
※ Phase 2 と違い「公開済みジャンル」の取得は **不要**（新規作成なので何もないのが正）。

### 2. CreateCompanyClient の組み込み

#### Props 拡張
```typescript
type Props = {
  // ... 既存 props
  availableGenres: { slug: string; name: string; display_order: number }[];
};
```

#### State 管理
- 既存のフォーム state（useState or useReducer）に `genres: string[]` を追加
- 初期値は `[]`

```tsx
const [genres, setGenres] = useState<string[]>([]);

// ...

<GenreChipSelector
  genres={availableGenres}
  selected={genres}
  onChange={setGenres}
/>
```

#### UI 配置
- Phase 2 と同じく「業種・フェーズ」セクションの直下あたりが候補
- セクション見出し: 「ジャンル」または「企業ジャンル（任意・複数選択可）」
- ヘルプテキスト: 「該当するジャンルを選択してください。検索や一覧表示で活用されます。」

### 3. POST ペイロードへの genres 追加

送信時のペイロードに `genres: string[]`（slug 配列）を含める:

```typescript
const response = await fetch("/api/biz/companies", {
  method: "POST",
  body: JSON.stringify({
    // ... 既存フィールド
    genres, // slug 配列
  }),
});
```

### 4. POST handler の ow_company_genres INSERT（最大の実装ポイント）

`src/app/api/biz/companies/route.ts`（または該当 POST handler）:

#### 既存処理
ow_companies に INSERT して company_id を取得 → レスポンス返却。

#### 追加するロジック
ow_companies INSERT 成功後、以下を実行:

```typescript
// 1. リクエストから genres を取り出す
const genreSlugs: string[] = body.genres ?? [];

// 2. 空配列なら skip
if (genreSlugs.length > 0) {
  // 3. slug → genre_id の解決
  const { data: genreRecords } = await supabase
    .from('ow_genres')
    .select('id, slug')
    .in('slug', genreSlugs);

  const genreIds = genreRecords?.map(g => g.id) ?? [];

  // 4. 不正な slug の警告ログ
  const missingSlugs = genreSlugs.filter(s => !genreRecords?.find(r => r.slug === s));
  if (missingSlugs.length > 0) {
    console.warn(`[biz/companies POST] Invalid genre slugs ignored: ${missingSlugs.join(', ')}`);
  }

  // 5. ow_company_genres に INSERT
  if (genreIds.length > 0) {
    const { error: genresError } = await supabase
      .from('ow_company_genres')
      .insert(
        genreIds.map(genre_id => ({ company_id: newCompanyId, genre_id }))
      );
    
    if (genresError) {
      // best-effort: ow_companies は成功済みなので、エラーログを残してレスポンスは成功扱い
      console.error(`[biz/companies POST] Failed to insert ow_company_genres for company ${newCompanyId}:`, genresError);
    }
  }
}
```

#### 重要: genres を ow_companies INSERT から除外

POST body をそのまま ow_companies に渡すと、存在しない `genres` カラムへの書き込みで失敗する。Phase 2 と同じパターンで除外:

```typescript
const { genres: _genresField, ...companyData } = body;

// ow_companies には companyData だけ渡す
const { data: newCompany } = await supabase
  .from('ow_companies')
  .insert(companyData)
  .select()
  .single();
```

#### best-effort の判断基準（Phase 2 と統一）

- ow_companies INSERT 成功 + ow_company_genres INSERT 失敗 → **201 を返す**（ログのみ）
- ow_companies INSERT 失敗 → 通常通り 500
- 理由: 企業本体が作成できているなら、後でジャンルだけ追加もできるため、ユーザー操作をブロックしない

## 受け入れ基準

1. `/biz/companies/add/new`（企業新規作成画面）でジャンルチップが表示される
2. チップタップで選択/解除でき、state に反映される（autosave はないので即時 API 呼び出しはなし）
3. ジャンル未選択（0件）でも企業作成が成功する
4. ジャンルあり（複数選択）で企業作成 → ow_company_genres に正しく INSERT される
5. 全8ジャンル選択で作成 → ow_company_genres に8レコード INSERT
6. 既存の企業作成フローに regression がない
7. `npm run build` 通過
8. `git push origin main` までセット
9. Vercel デプロイ確認

## やらないこと（明示）

- biz/auth（A）、admin（D）には触らない
- CompanyEditClient（B）には触らない（Phase 2 完了済み）
- 共通コンポーネント `GenreChipSelector` 自体の修正は原則不要
- ow_company_genres へのトランザクション化（PostgreSQL function 化）

## コミットメッセージ案

```
feat: integrate GenreChipSelector into CreateCompanyClient (PR-β Phase 3)

- Add availableGenres prop and genres state to CreateCompanyClient
- POST body includes genres (slug[]) array
- POST handler inserts ow_company_genres after ow_companies INSERT
- Best-effort: ow_companies success + ow_company_genres failure returns 201 with error log
- Invalid slugs logged as warnings, ignored safely
- Genres field excluded from ow_companies INSERT to avoid invalid column error
- No changes to admin/biz-auth/company-edit flows
```

## 完了後の報告事項

1. コミット hash
2. Vercel デプロイ完了確認
3. 動作確認結果（チップ表示 → 選択 → POST → ow_company_genres 確認の一連フロー）
4. ジャンル0件・複数件・全件の3パターンでテスト
5. Phase 4（biz/auth 多段フォーム）着手前に Claude（戦略担当）に投げ返したい論点があれば列挙

## 動作確認用のシナリオ

Vercel デプロイ後、以下を実施:

### Step 1: 表示確認
- `/biz/companies/add/new` を開く
- ジャンルチップ8個が表示される
- display_order 順で並んでいる

### Step 2: ジャンル0件で作成
- ジャンルを1つも選択せず、必須項目だけ埋めて作成ボタン
- 企業が作成され、ow_company_genres には何も INSERT されない

### Step 3: ジャンル複数件で作成
- 3〜4個のジャンルを選択して作成
- ow_company_genres に該当の company_id で3〜4レコード INSERT されている

### Step 4: 全8ジャンルで作成
- 全選択で作成
- ow_company_genres に8レコード

### Step 5: 既存フィールド regression 確認
- 企業名、業種、フェーズなどの既存入力で問題なく作成できる

## 重要: 既存運用ルールの遵守

- `npm run build` 必須
- `git push origin main` 必ず実行（commit hash で Vercel deployments 目視確認）
- POST handler 修正前に既存のレスポンス形式を確認（既存クライアントを壊さないため）
