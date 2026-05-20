# 調査レポート: 企業詳細ページにおけるジャンル表示の欠落

**調査日**: 2026-05-16  
**対象**: `/companies/[id]` 企業詳細ページ  
**優先度**: 🟡 中（情報設計の論点、緊急ではないが整合性に関わる）  
**ステータス**: 調査完了・Hisato さんとの思想確認待ち

---

## 1. データの実在確認結果

### ow_genres（全8件、全件 is_active = true）

| 表示順 | ジャンル名 | slug |
|------|-----------|------|
| 1 | 外資系 | foreign-capital |
| 2 | ホリゾンタルSaaS | horizontal-saas |
| 3 | バーティカルSaaS | vertical-saas |
| 4 | メガベンチャー | mega-venture |
| 5 | シード〜シリーズA | early-stage |
| 6 | AI・LLM特化 | ai-llm |
| 7 | DX/コンサル | dx-consulting |
| 8 | IPO準備中 | ipo-ready |

### ow_company_genres（現在の格納状況）

| 指標 | 値 |
|------|-----|
| 総レコード数 | **52件** |
| ジャンルあり企業数 | **30社** |
| ジャンルなし企業数 | **4社** |
| 最大ジャンル数（1企業） | **3ジャンル** |

### ジャンルごとの企業数

| ジャンル | 紐付き企業数 |
|---------|------------|
| 外資系 | 10 |
| バーティカルSaaS | 10 |
| DX/コンサル | 7 |
| メガベンチャー | 8 |
| シード〜シリーズA | 6 |
| AI・LLM特化 | 4 |
| IPO準備中 | 4 |
| ホリゾンタルSaaS | 3 |

### 企業ごとのジャンル数分布

| ジャンル数 | 企業数 |
|----------|------|
| 1ジャンル | 13社 |
| 2ジャンル | 12社 |
| 3ジャンル | 5社 |

1〜2ジャンルが大半で、最大3ジャンルまで確認。複数ジャンル掛け持ちが一般的な設計。

### 実例（複数ジャンルに属する企業サンプル）

| 企業名 | ジャンル |
|-------|---------|
| テスト株式会社_023 | 外資系 + DX/コンサル |
| テスト株式会社_018 | DX/コンサル + IPO準備中 |
| テスト株式会社_017 | 外資系 + メガベンチャー |
| テスト株式会社_014 | 外資系 + バーティカルSaaS + メガベンチャー |

### ⚠️ 重要: 現在のデータは全てテストデータ

紐付き企業の社名が全件「テスト株式会社_XXX」形式。  
**LayerX・SmartHR・HubSpot 等の本番企業への `ow_company_genres` 登録は未実施**と推定される。

つまり `/companies` 一覧のカルーセルに表示されているのもテスト企業のみであり、  
現時点では「一覧ページで見たジャンル → 詳細ページに遷移してもジャンルがない」という体験は、  
本番企業では **まだ発生していない**（一覧にも本番企業がジャンルで出ていないため）。

---

## 2. 企業詳細ページのデータ取得ロジック現状

### `getCompanyById` 関数

**ファイル**: `src/lib/supabase/queries.ts`（381〜416行）

```typescript
export async function getCompanyById(id: string): Promise<{ ... } | null> {
  const supabase = createClient();

  // ow_companies のみ取得（COMPANY_DETAIL_COLS）
  const { data, error } = await supabase
    .from("ow_companies")
    .select(COMPANY_DETAIL_COLS)
    .eq("id", id)
    .single();

  // ow_jobs, ow_roles, employee_categories を並列取得
  const [{ data: jobRows }, { data: roleRows }, employeeCategories] = await Promise.all([
    supabase.from("ow_jobs").select("id, title, ...").eq("company_id", id),
    supabase.from("ow_roles").select("id, name, parent_id"),
    getCompanyEmployeeCategories(id),
  ]);

  // ow_company_genres の取得は一切なし ← ここが抜けている
}
```

### COMPANY_DETAIL_COLS の内容

```typescript
const COMPANY_DETAIL_COLS = [
  // ow_companies カラムのみ（95カラム中の主要なもの）
  "id", "name", "tagline", "industry", "phase",
  "employee_count", "logo_gradient", "logo_letter",
  "accepting_casual_meetings", "updated_at",
  "remote_work_status", "flex_time", "side_job_ok",
  "mission", "description", "founded_year", "ceo_name",
  "location", "url", "company_features", "why_join",
  ...
  // ow_company_genres 関連カラムは一切ない
]
```

### Company 型にジャンルフィールドがあるか

**答え: なし**

`src/app/companies/mockCompanies.ts` の `Company` 型定義:

```typescript
export type Company = {
  id: string;
  name: string;
  tagline: string;
  industry: string;    // ← ow_companies.industry（"IT" 等の固定値）
  phase: string;       // ← ow_companies.phase（"シリーズB" 等）
  employee_count: number;
  // genres フィールドなし
};
```

### 詳細ページの「業界」「ステージ」表示箇所

**ファイル**: `src/app/(jobseeker)/companies/[id]/page.tsx`

- **Hero セクション（138行目）**: `company.industry` を表示
- **サイドバー COMPANY INFO（2590〜2591行目）**:
  ```typescript
  { key: "業界", value: company.industry },
  { key: "事業ステージ", value: company.phase },
  ```

これらは `ow_company_genres` ではなく、`ow_companies` テーブルの `industry` / `phase` カラムの値。

### 一覧ページとの比較

**一覧ページ** (`src/lib/genres.ts` — `fetchGenresWithCompanies()`):

```typescript
// ow_company_genres を JOIN して企業を取得
const { data: links } = await supabase
  .from("ow_company_genres")
  .select(`
    company_id,
    ow_companies!inner (id, name, industry, ...)
  `)
  .eq("genre_id", genre.id)
  .eq("is_human_approved", true)  // 人間承認済みのみ
```

**詳細ページ**: `ow_company_genres` の JOIN なし。

---

## 3. 問題の正体

**2層の問題が重なっている:**

### 問題①: データ取得が抜けている（コード側）

`getCompanyById` が `ow_company_genres` を JOIN していない。  
→ 詳細ページにジャンルデータが渡っていない。

### 問題②: 本番企業のジャンル紐付けが未実施（データ側）

現在 `ow_company_genres` に登録されているのはテスト企業のみ。  
→ 仮にコードを修正してもデータがないと表示されない。

### 問題③: UI の表示コンポーネントが未実装（UI 側）

`Company` 型に genre フィールドがなく、サイドバー COMPANY INFO にジャンル行もない。  
→ データを取得できても表示する場所がない。

**3層全て対応が必要。**

---

### ow_company_genres テーブルの設計メモ（実装時の参考）

```
カラム: company_id, genre_id, ai_confidence, 
        is_ai_suggested, is_human_approved, 
        approved_by, approved_at, created_at
```

**AI自動タグ付け → 人間承認のワークフロー**が設計されている:
- `is_ai_suggested = true`: AI が提案したジャンル
- `ai_confidence`: AI の確信度（numeric）
- `is_human_approved = true`: 人間が承認したものだけを表示に使う
- 一覧ページは `is_human_approved = true` のみを使用中

---

## 4. 修正方針の複数案

### 前提: 3層の修正が必要

| 層 | 作業内容 | 規模 |
|----|---------|------|
| データ | 本番企業への ow_company_genres 登録（Supabase 管理画面 or SQL） | 中（Hisato さんまたは柴さんの判断が必要） |
| コード（取得） | `getCompanyById` に ow_company_genres JOIN を追加 | 小 |
| コード（型） | `Company` / `CompanyDetail` 型に `genres` フィールドを追加 | 小 |
| コード（UI） | 詳細ページにジャンル表示を追加（案A/B/C のいずれか） | 小〜中 |

---

### 案A: COMPANY INFO エリアに「ジャンル」行を追加

```
業界: IT
事業ステージ: シリーズB
従業員数: 200名
ジャンル: [外資系] [ホリゾンタルSaaS]  ← 追加
所在地: 東京
```

| 項目 | 内容 |
|------|------|
| **メリット** | 既存の「業界」「ステージ」と同じ文脈に収まる。UI の変更が最小。 |
| **デメリット** | ジャンルは複数値なのにサイドバーは単一値を想定している行列形式 → チップ表示にする工夫が必要。 |
| **作業量** | 小（取得クエリ修正 + 型追加 + UI 1行追加） |
| **適する場面** | 「ジャンルは補足属性」として位置付ける場合 |

---

### 案B: ヒーロー部分（企業名直下）にジャンルチップ表示

```
[企業ロゴ]  LayerX
            外資系・メガベンチャー に特化したSaaS企業
            [外資系] [ホリゾンタルSaaS]  ← チップ追加
```

| 項目 | 内容 |
|------|------|
| **メリット** | 最初に目に入る。「この企業がどのジャンルか」がページを開いた瞬間に分かる。一覧で見たジャンルと対応関係が明確になる。 |
| **デメリット** | ヒーロー部分は既に要素が多い。チップが増えると視覚的に混雑する可能性。 |
| **作業量** | 小〜中（ヒーロー部分の実装が複雑な場合、行を読み解くコストあり） |
| **適する場面** | 「ジャンルは第一級の企業属性」として位置付ける場合 |

---

### 案C: ヒーロー直下に小さくブレッドクラム風表示

```
Opinio / 外資系 / LayerX  ← ジャンルをブレッドクラムに組み込む
```

一覧ページのカルーセルから遷移してきた場合に「どのジャンルから来たか」を明示する案。  
URL パラメータ（`?from_genre=foreign-capital`）を使って動的に切り替えることも可能。

| 項目 | 内容 |
|------|------|
| **メリット** | 「ジャンル → 企業詳細」の導線を UX として明示できる。カルーセルからの文脈を保持できる。 |
| **デメリット** | 複数ジャンルに属する企業の場合、ブレッドクラムが1つに絞られる。直接アクセスした場合は表示できない。 |
| **作業量** | 中（URL パラメータの受け取りと表示の両方が必要） |
| **適する場面** | 「ジャンルは検索・分類のためのタグ」として位置付け、ナビゲーション文脈を重視する場合 |

---

## 5. 推奨案と思想の議論材料

### Claude の推奨: 案A + 将来的に案B へ

**短期（案A）:**
- 作業量最小で3層の問題を全て解決できる
- データ登録とコード修正を一緒に進めやすい
- 「まず動かす」段階として適切

**中期（案B への発展）:**
- 本番企業のジャンルデータが整備されてから、ヒーロー部分に昇格させる
- カルーセルとの往来が増えてきたら、ユーザーが「このジャンルとは何か」を直感的に理解できる UI が必要になる

---

### Hisato さんとの議論材料

**論点 1: ジャンルは「業界」と何が違うか**

- `ow_companies.industry` = 例「IT」「金融」等（汎用業界分類、単一値）
- `ow_genres` = 例「外資系」「AI・LLM特化」等（Opinio 独自の視点分類、複数値可能）
- ジャンルは Opinio が「どういう企業か」を独自視点で伝えるラベル → 第一級の属性として扱うべき可能性が高い

**論点 2: 1企業が複数ジャンルに属する場合の表示**

- 現在のデータでは最大3ジャンル（外資系 + バーティカルSaaS + メガベンチャー等）が存在
- 案A（サイドバー行）はチップ形式にすれば複数表示に自然対応できる
- 案B（ヒーロー）は複数チップ横並びで表示可能

**論点 3: AI タグ付け機能の活用方針**

- `is_ai_suggested` + `ai_confidence` + `is_human_approved` の3カラムが設計されている
- 将来的に「AI が提案したが未承認」のジャンルを管理画面でレビューする UI を作るか
- または「承認済みのみ表示」の現行方針のまま運用するか

---

## 6. 副次的な発見

### ジャンルページ (`/companies?genre=xxx`) が存在しない

`GenreSection.tsx` の「すべて見る →」リンクは `/companies?genre=foreign-capital` を向いているが、  
この URL でジャンルフィルタリングされる実装が `page.tsx` に存在しない（searchParams を受け取っていない）。  
→ 「すべて見る」をクリックしても全企業が表示されるだけ、またはフィルターが無視される可能性がある。  
**L2（フィルター機能）の実装時に一緒に対応すべき論点。**

### 求人詳細ページにもジャンル情報がない

`/jobs/[id]` も企業ジャンルを表示していないと推定される（getJobById も ow_company_genres JOIN なし）。  
求人詳細から「この企業はどんなジャンルか」が分からない状態。  
→ 企業詳細と同時に対応するか、後回しにするかの優先度判断が必要。

---

## 実装メモ（実施時の参考）

### データ取得クエリ追加（案A の場合）

```typescript
// getCompanyById 内の Promise.all に追加
const [{ data: jobRows }, { data: roleRows }, employeeCategories, { data: genreRows }] = 
  await Promise.all([
    supabase.from("ow_jobs").select("...").eq("company_id", id),
    supabase.from("ow_roles").select("..."),
    getCompanyEmployeeCategories(id),
    // ↓ 追加
    supabase
      .from("ow_company_genres")
      .select("genre_id, ow_genres(id, name, slug)")
      .eq("company_id", id)
      .eq("is_human_approved", true),
  ]);
```

### 型追加

```typescript
// Company 型に追加
genres?: { id: string; name: string; slug: string }[];
```

### UI 追加（案A: COMPANY INFO サイドバー行）

```tsx
{ key: "ジャンル", value: company.genres?.map(g => g.name).join(" · ") ?? "—" },
```

または複数チップ形式:
```tsx
{company.genres && company.genres.length > 0 && (
  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
    {company.genres.map(g => (
      <span key={g.id} style={{ fontSize: 11, padding: "2px 8px", background: "var(--bg-tint)", borderRadius: 4, border: "1px solid var(--line)" }}>
        {g.name}
      </span>
    ))}
  </div>
)}
```

### データ登録

本番企業（LayerX・SmartHR 等）への `ow_company_genres` 登録は SQL で一括投入が最速:
```sql
-- 例: LayerX を「外資系」「ホリゾンタルSaaS」に登録
INSERT INTO ow_company_genres (company_id, genre_id, is_ai_suggested, is_human_approved)
VALUES
  ('<layerx-uuid>', '<foreign-capital-genre-uuid>', false, true),
  ('<layerx-uuid>', '<horizontal-saas-genre-uuid>', false, true);
```
→ 柴さんとの調整が必要。
