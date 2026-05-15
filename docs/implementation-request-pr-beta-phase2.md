# 実装依頼: PR-β Phase 2 — CompanyEditClient へのジャンル統合 + PATCH handler 拡張

## 背景

PR-β（企業作成/編集フォームのジャンル化）の Phase 2。
Phase 1 で共通コンポーネント `GenreChipSelector` を作成済み（コミット `12ebb2d`、動作確認済み）。

事前調査レポート: `docs/research-2026-05-17-pr-beta-company-form-genres.md`
Phase 1 実装依頼書: `docs/implementation-request-pr-beta-phase1.md`

## 前提条件（確認済み事項）

### ow_genres テーブル — 確認済み ✅
Supabase で実物確認済み:
- カラム: `id (UUID), slug (text), name (text), description (text), display_order (int), is_active (boolean), created_at, updated_at`
- 8ジャンル全件 `is_active = true`、`display_order` 1〜8
- slug 一覧: `foreign-capital, horizontal-saas, vertical-saas, mega-venture, early-stage, ai-llm, dx-consulting, ipo-ready`

### 確定済み方針（必読）
- **データ保持**: slug 配列（id ではない）
- **autosave**: 既存の 700ms debounce + PUT `/api/biz/company` に乗せる
- **draft_data**: `genres: string[]`（slug 配列）として保持
- **公開時の ow_company_genres 反映**: **パターンX（全置換: 既存を全 DELETE → 新配列を全 INSERT）**
- **「未公開ジャンル変更」可視化**: しない（選択肢A）。チップは draft 状態を表示、他フィールドと同じ扱い
- **admin 画面（D）は今回触らない**（方式②）。既存の独自実装はそのまま

## Phase 2 のスコープ

### 触るファイル（4ファイル想定）

1. `src/app/biz/company/page.tsx`（Server Component） — ow_genres 全件取得 + props 渡し追加
2. `src/app/biz/company/CompanyEditClient.tsx` — GenreChipSelector の組み込み、autosave 連携
3. `src/types/biz-company.ts`（または BizCompany 型の定義箇所） — `genres: string[]` 追加
4. `src/lib/biz-company-transform.ts`（または transformFormToDb / transformDbToForm の実装箇所） — genres フィールドのマッピング追加
5. `src/app/api/biz/company/route.ts`（PATCH handler） — ow_company_genres 反映ロジック追加

※ 上記は調査レポートからの推定。実際のファイルパスは事前調査結果に従ってください。

### 触らないファイル
- `src/app/biz/auth/page.tsx`（Phase 4 で扱う）
- `src/app/biz/companies/add/new/CreateCompanyClient.tsx`（Phase 3 で扱う）
- `src/app/admin/companies/[id]/CompanyDetailClient.tsx`（方式②: 今回触らない）

## 詳細仕様

### 1. Server Component（page.tsx）でのデータ取得

`src/app/biz/company/page.tsx`（または該当 Server Component）で、既存の company データ取得に加えて以下を追加:

```typescript
const { data: genres } = await supabase
  .from('ow_genres')
  .select('slug, name, display_order')
  .eq('is_active', true)
  .order('display_order', { ascending: true });
```

取得した `genres` を `CompanyEditClient` に props で渡す。

### 2. BizCompany 型の拡張

`BizCompany` 型（または同等の型）に以下を追加:

```typescript
genres: string[]; // slug 配列。空配列を許容
```

null/undefined ではなく **常に配列**（空配列 OK）。`genres ?? []` で正規化。

### 3. CompanyEditClient の組み込み

`src/app/biz/company/CompanyEditClient.tsx`:

#### Props 拡張
```typescript
type Props = {
  // ... 既存 props
  genres: { slug: string; name: string; display_order: number }[];
};
```

#### UI 配置
- 既存のフォーム内、適切なセクションに `GenreChipSelector` を配置
- 配置位置の候補: 「企業情報」または「業種・規模」セクションの下あたり（要 Hisato 確認）
- セクション見出し: 「ジャンル」または「企業ジャンル（任意・複数選択可）」
- ヘルプテキスト: 「該当するジャンルを選択してください。検索や一覧表示で活用されます。」

#### autosave 連携
- `update("genres", newSlugs)` パターンで既存の autosave フックに乗せる（調査レポート記載通り）
- 構造変更は不要、既存 update 関数の引数として genres を渡すだけ

```tsx
<GenreChipSelector
  genres={genres}
  selected={formData.genres ?? []}
  onChange={(newSlugs) => update("genres", newSlugs)}
/>
```

### 4. transformFormToDb / transformDbToForm の更新

#### transformFormToDb（フォーム → draft_data）
```typescript
return {
  // ... 既存フィールド
  genres: form.genres ?? [], // slug 配列をそのまま draft_data に
};
```

#### transformDbToForm（DB → フォーム）
- ow_companies.draft_data に genres が入っていればそれを使う
- なければ ow_company_genres + ow_genres を JOIN して現在の公開ジャンルを取得し、初期値とする
- フォーム初期表示の優先順位: `draft_data.genres > ow_company_genres から取得した現在の公開状態 > 空配列`

```typescript
// 擬似コード
const formGenres = draftData?.genres 
  ?? currentPublishedGenres  // ow_company_genres から取得済み
  ?? [];
```

`currentPublishedGenres` は Server Component で取得して props で渡す方が筋がいい（クライアントで JOIN クエリを書きたくない）。

### 5. PATCH handler の ow_company_genres 反映（最大の難所）

`src/app/api/biz/company/route.ts`（または該当 PATCH handler）:

#### 現状（調査レポート記載）
draft_data を ow_companies に spread するだけ。

#### 追加するロジック
draft_data spread 後、以下を実行:

```typescript
// 1. draft_data から genres を取り出す
const genreSlugs: string[] = draftData?.genres ?? [];

// 2. slug → genre_id の解決
const { data: genreRecords } = await supabase
  .from('ow_genres')
  .select('id, slug')
  .in('slug', genreSlugs);

const genreIds = genreRecords?.map(g => g.id) ?? [];

// 3. パターンX: 既存を全 DELETE
await supabase
  .from('ow_company_genres')
  .delete()
  .eq('company_id', companyId);

// 4. 新しい配列を全 INSERT
if (genreIds.length > 0) {
  await supabase
    .from('ow_company_genres')
    .insert(
      genreIds.map(genre_id => ({ company_id: companyId, genre_id }))
    );
}
```

#### トランザクション
- DELETE と INSERT の間で失敗すると不整合になる
- Supabase の場合、RPC または PostgreSQL function でトランザクション化が理想だが、Phase 2 では **try-catch でエラーロギングしつつ、失敗時は明確にエラーレスポンス** を返す形で OK（PR-α 同様の運用と整合）
- 将来的に PostgreSQL function 化は別途検討（Phase 6 とか）

#### 不正な slug の扱い
- `genreSlugs` に存在しない slug が混じっていた場合、`genreRecords` には含まれないので自動的に無視される（安全側に倒れる）
- ログには warn を出しておく:

```typescript
const missingSlugs = genreSlugs.filter(s => !genreRecords?.find(r => r.slug === s));
if (missingSlugs.length > 0) {
  console.warn(`[biz/company PATCH] Invalid genre slugs ignored: ${missingSlugs.join(', ')}`);
}
```

### 6. draft_data から genres の削除タイミング

PATCH 成功後、draft_data 内の genres フィールドはどうするか:

- **方針A**: draft_data はそのまま残す（他フィールドと同じ扱い、次の編集で上書きされる）
- **方針B**: PATCH 成功時に draft_data から genres を削除

**方針Aで進める**（他フィールドの挙動と一貫させる）。

## 受け入れ基準

1. `/biz/company`（自社編集画面）でジャンルチップが表示される
2. チップタップで選択/解除でき、autosave が走る（ネットワークタブで PUT 確認）
3. ページリロード後も draft 状態が保持されている（draft_data から読み戻し成功）
4. 「変更を公開する」ボタン押下後、ow_company_genres に正しく反映される
5. 全選択 → 公開 → 全解除 → 公開、で ow_company_genres が空になることを確認
6. 既存の他フィールド編集に regression がない
7. `npm run build` 通過
8. `git push origin main` までセット
9. Vercel デプロイ確認

## やらないこと（明示）

- CreateCompanyClient（C）、biz/auth（A）、admin（D）には触らない
- 共通コンポーネント `GenreChipSelector` 自体の修正は原則不要（必要な場合は事前報告）
- ow_company_genres へのトランザクション化（PostgreSQL function 化）
- 「未公開変更あり」バッジ表示

## コミットメッセージ案

```
feat: integrate GenreChipSelector into CompanyEditClient (PR-β Phase 2)

- Add genres field to BizCompany type (slug[] array)
- Server Component fetches ow_genres + current published genres, passes as props
- transformFormToDb / transformDbToForm handle genres field
- Autosave persists genres into ow_companies.draft_data
- PATCH handler reflects draft_data.genres into ow_company_genres
  (Pattern X: full replace via DELETE + INSERT)
- Invalid slugs logged as warnings, ignored safely
- No changes to admin/biz-auth/create-company flows (deferred to later phases)
```

## 完了後の報告事項

1. コミット hash
2. Vercel デプロイ完了確認
3. 動作確認結果(編集 → autosave → リロード → 公開 → DB 反映の一連フロー)
4. `ow_company_genres` テーブルの実際の挙動確認（少なくとも1社で全選択 → 公開 → 全解除 → 公開）
5. Phase 3（CreateCompanyClient）着手前に Claude（戦略担当）に投げ返したい論点があれば列挙

## 動作確認用のテスト企業

事前調査レポートに動作確認用テスト企業の候補が記載されているはず。それを使用すること。
なければ「draft_data が空の企業」「draft_data に既にデータが入っている企業」両方で確認。

## 重要: 既存運用ルールの遵守

- `npm run build` 必須
- `git push origin main` 必ず実行（commit hash で Vercel deployments 目視確認）
- 新規 UI コンポーネント前に `ls src/components/ui/` で既存資産確認（今回は不要、`GenreChipSelector` が既存資産として使える）
