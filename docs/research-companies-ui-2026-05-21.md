# /companies UI/UX 調査レポート

**作成日**: 2026-05-21  
**調査者**: Claude Code（コード読み取りのみ）  
**調査方式**: src/ 配下全ファイル + supabase/migrations/ + tailwind.config.ts を読み取り  
**対象ページ**: `/companies` (ジャンル別カルーセル表示) 及び `/companies/list` (検索フィルタ表示)

---

## 既存関連ドキュメントの確認

### 確認済みドキュメント

1. **research-companies-search.md** (2026-05-17)
   - 検索・フィルタ機能の実装仕様書
   - フィルタ軸: 業種、従業員規模、勤務形態、募集中フラグ
   - URL 設計: `/companies?q=...&industry=...`

2. **research-companies-carousel-redesign.md** (2026-05-17)
   - カルーセル 5 列、peek デザイン
   - カード内容: ロゴ、業種・規模・募集職種数、タグ
   - 説明文・「詳細を見る」ボタンは詳細ページに集約

3. **research-2026-05-16-companies-l6-card-truncation.md**
   - 4 列目カード途切れバグ（既修正）
   - GenreCarousel.tsx の padding-right 追加で解決

---

## 1. 背景色

### 現状

**黄土色（#F5F4F0）がページ背景に適用されている。**

- **確認ファイル**: `/Users/hisato/opinio-work/src/app/globals.css:109`
- **CSS変数定義**: `--background: #F5F4F0;`
- **body への適用**: `globals.css:126` で `background: var(--background);`
- **tailwind.config.ts:15** でも定義: `background: "#F5F4F0"`

### 影響範囲の判定

**全体的な影響**:
- root で定義されているため、**全ページ共通の背景色**
- レポート名「Legacy」とコメント「ページ互換」から、既存コードベースの設計判断が反映されている

**/(jobseeker)/companies ページ固有**:
- `src/app/(jobseeker)/companies/page.tsx:38` で `max-w-6xl mx-auto px-4 py-6` 
- スタイル指定で上書きなし → グローバル背景色をそのまま使用

**他ページへの波及確認**:
- `/companies/list` (検索フィルタ表示時) でも同じ背景色
- `src/app/(jobseeker)/companies/CompaniesClient.tsx:345` で `background: "var(--bg-tint)"` と別指定している箇所あり（#F8FAFC）
  - これは CompaniesClient が独立したページコンポーネント

**結論**: 
- 黄土色 #F5F4F0 は**ページ全体共通**の背景色
- `/companies` ページ「限定」ではなく、全サイトに波及
- 他ページ（/jobs, /articles, /mentors 等）でも同じ背景色が適用されている

---

## 2. 上部ヘッダーコピー

### 現状

**3 行構成の見出しセクション**:

```
Opinio / 企業を知る        ← パンくず（text-xs text-gray-400）
企業を、知る。              ← メイン見出し（text-2xl font-medium serif）
IT/SaaS業界をジャンル別に。気になる1社が必ず見つかる。  ← サブテキスト（text-sm text-gray-500）
```

### 該当ファイル:行

- **`src/app/(jobseeker)/companies/page.tsx:39-49`**

```tsx
<div className="mb-6">
  <p className="text-xs text-gray-400 mb-1">Opinio / 企業を知る</p>
  <h1
    className="text-2xl font-medium mb-1"
    style={{ fontFamily: "serif" }}
  >
    企業を、知る。
  </h1>
  <p className="text-sm text-gray-500">
    IT/SaaS業界をジャンル別に。気になる1社が必ず見つかる。
  </p>
</div>
```

### レイアウト分析

| 要素 | 値 | px 変換 |
|------|-----|---------|
| パンくず | `text-xs` | ~12px |
| パンくず色 | `text-gray-400` | ~#9CA3AF |
| パンくず下マージン | `mb-1` | 4px |
| 見出し | `text-2xl` | ~24px |
| 見出し太さ | `font-medium` | 500 |
| 見出しフォント | serif | Noto Serif JP |
| 見出し下マージン | `mb-1` | 4px |
| サブテキスト | `text-sm` | ~14px |
| サブテキスト色 | `text-gray-500` | ~#6B7280 |
| 全体マージン下 | `mb-6` | 24px |
| ページコンテナ padding | `px-4 py-6` | left/right 16px, top/bottom 24px |
| ページコンテナ max-幅 | `max-w-6xl` | 1280px (Tailwind) |

### ファーストビュー占有率の所感

- **見出し + サブテキスト合計**: ~42px（見出し24px + サブテキスト14px + マージン 4px）
- **検索バー実装後**: `mt-6` で 24px 下マージン
- **ビューポート高さ（1920×1080 想定）**: 1080px
- **占有率**: 約 4.5%（ファーストビュー内に完全納収）

**デザイン方針**:
- シンプルで洗練、目立ちすぎない
- serif フォントで「知る」の高級感を演出
- パンくず・見出し・説明の 3 段階で情報階層化

---

## 3. 企業カードの情報量

### 現在表示しているフィールド一覧（CompanyCardCompact）

**`src/components/companies/CompanyCardCompact.tsx` より:**

| セクション | フィールド | 型 | 表示方式 |
|-----------|-----------|-----|---------|
| **ロゴ領域（上）** | `logo_url` | string \| null | Image（16:10 aspect） |
| | `logo_letter` | string \| null | フォールバック（company.name の1文字） |
| | `logo_gradient` | 色コード | プレースホルダー色（ハッシュ関数で決定論的） |
| **社名** | `name` | string | 2 行クランプ（WebkitLineClamp: 2） |
| **メタ情報** | `industry` | string \| null | 業種 |
| | `employee_count` | string \| null | 従業員数 |
| | `job_count` | number | 募集中求人数（「募集中N」） |
| **タグ** | `accepting_casual_meetings` | boolean | 「面談OK」バッジ |
| | `remote_work_status` | string \| null | 「フルリモート」「ハイブリッド」バッジ |

### 取得しているが表示に使っていないフィールド

**`src/lib/genres.ts:40-43` の select 句:**

```typescript
`
  company_id,
  ow_companies!inner (
    id, name, industry, funding_stage, employee_count,
    description, accepting_casual_meetings, remote_work_status,
    logo_letter, logo_gradient, logo_url, updated_at
  )
`,
```

**表示に使っていない**:
- `funding_stage` — 資金調達段階（シリーズA、B 等）
- `description` — 企業説明文
- `updated_at` — 更新日時

**CompanyCardCompact での利用状況**:
- `description` は取得するが、**一切使用していない** ← **削除可能な候補**
- `funding_stage` も同様 ← **削除可能な候補**
- `updated_at` も同様 ← **削除可能な候補**

### 増やせる事実情報の候補

**DB に存在するが、現在取得していないフィルド**（migrations:767-773）:

| カラム | 説明 | 表示候補 |
|--------|------|---------|
| `headquarters_address` | 本社所在地 | メタ行に追加（「東京都渋谷区」形式） |
| `nearest_station` | 最寄り駅 | 所在地の後に追加（「渋谷駅 5 分」形式） |
| `about_markdown` | 企業概要 | 説明文として活用 |
| `business_stage` | 事業段階 | メタ行に追加 |
| `established_at` | 創立年 | メタ行に追加 |
| `benefits` | 福利厚生（TEXT[]） | タグ化 |
| `work_time_system` | 勤務時間制度 | タグ化 |
| `evaluation_system` | 評価制度 | タグ化 |

---

## 4. 所在地データ構造

### カラム名・型

**ow_companies テーブル:**

```sql
location TEXT                      — 住所文字列（例: "東京都渋谷区道玄坂2-1"）
headquarters_address TEXT          — 本社所在地（より詳細）
nearest_station TEXT               — 最寄り駅（例: "渋谷駅 徒歩 5 分"）
```

**ソース**:
- `supabase/migrations/031_opinio_phase1_core_schema.sql:767-768`

### 実データの表記実態（コードから推定）

**現在の利用箇所**:
- `src/lib/utils/location.ts` の `extractPrefecture()` で都道府県を正規表現抽出
- 対応フォーマット:
  - `"東京都渋谷区..."` → `"東京都"`
  - `"大阪府大阪市..."` → `"大阪府"`
  - `"北海道札幌市..."` → `"北海道"`
  - その他 43 県: `"○○県"`

**推定フォーマット**:
- `location` は **「都道府県 + 市区町村」形式**（例: 東京都渋谷区）
- `nearest_station` は **「駅名 + 徒歩分数」形式**（推定）

**データ確認方法**:
- Supabase MCP ツールなしでは実データ表記を直接確認不可
- 本調査では **コードから推定した構造のみ報告**
- **実データ確認は別途 Supabase ブラウザ / select コマンド で実施が必要**

### 絞り込み実現可能性の判定

**都道府県絞り込み: ✅ 即座に実装可能**
- `location` テキストから都道府県を抽出する関数が既に存在
- `PREFECTURES` マスタ（47 都道府県）も定義済み
- `/companies/list` ページ（CompaniesClient.tsx）では既に実装済み
  - `prefecture` パラメータでフィルタ可能
  - 利用可能な都道府県のみドロップダウンに表示

**最寄り駅絞り込み: ⚠️ 実装可能だが要設計**
- `nearest_station` カラムが存在
- ただし「駅名」だけで検索するか、「駅名 + 分数」で検索するかの設計判断が必要
- 実データの統一フォーマット確認後、フィルタ ロジックを決定

**勤務形態（リモート・ハイブリッド）絞り込み: ✅ 既に実装済み**
- `remote_work_status` で対応
- `/companies` ページの CompanySearchBar で使用可能

**本社所在地・駅名・福利厚生の「詳細表示」: ✅ 実装可能**
- CompanyCardCompact にフィールドを追加して表示可能
- ただし **情報密度が高くなるため、カード設計の見直しが必要**

---

## 実装に進む前に確認すべき設計判断

### パッケージ設計

- [ ] 企業カードの情報密度をどこまで増やすか？
  - 現在: 業種・規模・募集数のみ（シンプル）
  - 案1: + 所在地（都道府県）を 1 行追加
  - 案2: + 最寄り駅も追加（2 行） → カード高さ増加
  - 案3: 現状維持（詳細は企業ページで確認）

### 背景色の統一性

- [ ] 黄土色 #F5F4F0 は全サイトの背景色であることを確認
  - 現在 `/companies`, `/jobs`, `/articles` 等で共通適用
  - 同色で OK か、各ページ別の背景色が必要か検討

### 所在地フィルタの実装範囲

- [ ] 都道府県フィルタのみで十分か？（現状）
  - 実装済み: `/companies/list` で活用中
  - 追加要件: 複数都道府県 AND フィルタか OR フィルタか

- [ ] 駅名フィルタの必要性
  - 「渋谷駅」「新宿駅」など駅別で絞り込める価値があるか
  - 実データの `nearest_station` フォーマット統一が前提

### データフェッチ最適化

- [ ] 現在 CompanyCardCompact が `description`, `funding_stage`, `updated_at` を取得しながら未使用
  - 削除して フェッチコスト削減可能？
  - または後で使用予定？ → 確認必要

### ページレイアウト

- [ ] 見出しコピー「企業を、知る。」の serif 見出し + サブテキストは求職者には響くか
  - UI 改善の余地があるか、A/B テスト候補？
  - 現状は洗練だが目立たないデザイン

---

## 付録: ファイルパス一覧

### メインページファイル
- `/Users/hisato/opinio-work/src/app/(jobseeker)/companies/page.tsx`
- `/Users/hisato/opinio-work/src/app/(jobseeker)/companies/CompaniesClient.tsx`

### コンポーネント
- `/Users/hisato/opinio-work/src/components/companies/CompanyCardCompact.tsx`
- `/Users/hisato/opinio-work/src/components/companies/GenreCarousel.tsx`
- `/Users/hisato/opinio-work/src/components/companies/GenreSection.tsx`
- `/Users/hisato/opinio-work/src/components/companies/CompanySearchBar.tsx`
- `/Users/hisato/opinio-work/src/components/companies/CompanySearchResults.tsx`

### データ取得・検索ロジック
- `/Users/hisato/opinio-work/src/lib/genres.ts`
- `/Users/hisato/opinio-work/src/lib/search/companies.ts`

### 型定義
- `/Users/hisato/opinio-work/src/types/genre.ts`

### ユーティリティ
- `/Users/hisato/opinio-work/src/lib/utils/location.ts`

### スタイル
- `/Users/hisato/opinio-work/src/app/globals.css`
- `/Users/hisato/opinio-work/tailwind.config.ts`

### DB スキーマ
- `/Users/hisato/opinio-work/supabase/migrations/031_opinio_phase1_core_schema.sql` (ow_companies 定義)

