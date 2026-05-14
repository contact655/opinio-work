# 事前調査依頼: PR-β 企業作成/編集フォームのジャンル化

## 背景

PR-α（企業詳細にジャンル表示）が完了し本番反映済み（コミット `141a2bd`）。
次のステップとして、企業作成/編集フォームでジャンルを設定できるようにする PR-β に着手する。

## 確定済みの思想・方針

### 入力 UI
- **チップ群**（8ジャンル全部表示、タップで選択/解除）
- 選択は **任意**、**複数選択可**、上限なし
- 表示順は `ow_genres.display_order` 昇順

### 保存方式
- **autosave に乗せる**（既存の draft_data 運用と整合）
- **方式A**: draft_data の中に `genres: string[]`（slug 配列）として保持
- 「変更を公開する」時に ow_company_genres テーブルへ INSERT/DELETE で反映
- 編集中は ow_company_genres を直接いじらない（下書き = 公開済みになるのを防ぐ）

### 8ジャンル（参考）
| display_order | name | slug |
|---|---|---|
| 1 | 外資系 | foreign-capital |
| 2 | ホリゾンタルSaaS | horizontal-saas |
| 3 | バーティカルSaaS | vertical-saas |
| 4 | メガベンチャー | mega-venture |
| 5 | シード〜シリーズA | early-stage |
| 6 | AI・LLM特化 | ai-llm |
| 7 | DX/コンサル | dx-consulting |
| 8 | IPO準備中 | ipo-ready |

## 調査してほしいこと

### 1. 既存 autosave 実装の実態
- どこで autosave のフック/関数が定義されているか
- デバウンスの設定値（ms）
- どのフィールドが autosave 対象になっているか
- autosave が呼ぶ API ルート（パス、メソッド、ペイロード形式）
- draft_data に書く具体的なコード箇所

### 2. draft_data のスキーマと運用
- ow_companies テーブルの draft_data カラムの型（JSONB 想定）
- 現在 draft_data に入っているフィールドの全リスト
- 「変更を公開する」処理の実装場所（どのファイル、どの関数）
- 公開処理で draft_data → 本番カラムへの展開ロジック

### 3. 4ファイルそれぞれの影響範囲

#### A. `src/app/biz/auth/page.tsx`
- PendingCompany を経由した多段フォームの全体像
- どのステップで「企業情報入力」が発生するか
- ジャンル選択を入れるならどのステップか
- PendingCompany のスキーマ（一時保存先の構造）
- 本番企業作成時のジャンル反映タイミング

#### B. `src/app/biz/company/CompanyEditClient.tsx`
- "use client" の制約上、ow_genres 一覧をどう取得するか
- Server Component 親（page.tsx）でジャンル一覧を取得 → props で渡す形のコスト
- 既存の編集フォームの状態管理（useState? useReducer? React Hook Form?）
- ジャンルチップ群を入れる位置の候補（既存セクションのどこに挟むか）

#### C. `src/app/biz/companies/add/new/CreateCompanyClient.tsx`
- 「企業を追加」フローの全体像（auth/page.tsx の新規作成とどう違うか）
- 既存ジャンル選択箇所の有無
- 同じくジャンル一覧取得の経路

#### D. `src/app/admin/companies/[id]/CompanyDetailClient.tsx`
- 運営側管理画面でのジャンル編集 UI の必要性
- ここは autosave ではなく明示的保存の可能性あり（admin 画面の既存パターン要確認）
- 既存企業のジャンル手動マッピング（admin 作業）の UI

### 4. 共通コンポーネント候補
- 4ファイルで使い回せる `GenreChipSelector` 的なコンポーネントを `src/components/ui/` に作る価値があるか
- 既存の Chip / Badge / Toggle 系コンポーネントの有無（`ls src/components/ui/` で確認）

### 5. 動作確認用テスト企業
- `is_published=true` かつ「企業編集」「企業作成」両方の動作確認に使える企業
- draft_data がすでに入っている企業 / 空の企業 両方

## 出力形式

`docs/research-2026-05-17-pr-beta-company-form-genres.md` として保存。
セクションごとに「現状」「PR-β での変更点」「実装の難所」を明記。

## 注意

- 実装はまだしない。**調査のみ**。
- 不明点や追加で判断が必要な論点があれば、レポート末尾に「Hisato さん + Claude への質問」セクションを設けて列挙すること。
