# OPINIO プロダクト棚卸しレポート

> 作成日: 2026-07-10  
> 対象: `/Users/hisato/opinio-work` リポジトリの実装状態  
> 方針: 実装済みの事実のみを記述。未実装のものは明示する。

---

## 1. 実装済み機能一覧

### 求職者向け（公開・認証不要）

| ページ | パス | 状態 |
|--------|------|------|
| トップページ（LP） | `/` | ✅ 実装済み（Supabase接続・動的統計表示） |
| 企業一覧 | `/companies` | ✅ 実装済み（Supabase接続・フィルター・検索） |
| 企業詳細 | `/companies/[id]` | ✅ 実装済み（Supabase接続・口コミ・給与・求人埋め込み） |
| 企業スワイプUI | `/companies/swipe` | ✅ 実装済み（API Route経由でデータ取得・気になりブックマーク連動） |
| 企業比較 | `/companies/compare` | ✅ ページ実装済み。ただし **エントリーポイントが不完全**（後述） |
| 求人一覧 | `/jobs` | ✅ 実装済み（Supabase接続・サイドバーフィルター・面談受付中トグル） |
| 求人詳細 | `/jobs/[id]` | ✅ 実装済み（Supabase接続・会社情報JOIN） |
| メンター一覧 | `/mentors` | ✅ 実装済み（Supabase接続・写真表示） |
| メンター詳細 | `/mentors/[id]` | ✅ 実装済み（Supabase接続） |
| 記事一覧 | `/articles` | ✅ 実装済み（Supabase接続） |
| 記事詳細 | `/articles/[slug]` | ✅ 実装済み（Supabase接続） |
| 話せる人（アンバサダー） | `/people` | ✅ 実装済み（Supabase接続・`ow_company_admins.is_ambassador`で表示制御） |
| キャリア軌跡一覧 | `/career-trajectories` | ❌ **未実装**（DBテーブルは存在するがページルートなし） |
| 転職ストーリー | `/career-changes/[slug]` | ✅ 実装済み（静的データ） |
| About | `/about` | ✅ 実装済み |
| 業種一覧 | `/industries` | ✅ 実装済み |
| 料金ページ | `/pricing` | ✅ 実装済み |

### 求職者向け（認証必要）

| ページ | パス | 状態 |
|--------|------|------|
| 認証（サインアップ/ログイン） | `/auth` | ✅ 実装済み（Supabase Auth） |
| オンボーディング | `/onboarding` | ✅ 実装済み（3ステップ・スキップ可） |
| プロフィール編集 | `/profile/edit` | ✅ 実装済み（自動保存・タブ構成） |
| マイページ | `/mypage` | ✅ 実装済み（応募・面談・ブックマーク・メンター相談管理） |
| カジュアル面談申込 | `/companies/[id]/casual-meeting` | ✅ 実装済み（在籍企業制約あり） |
| メンター相談予約 | `/mentors/[id]/reserve` | ✅ 実装済み（5ステップフロー） |
| 求人応募 | `/jobs/[id]/apply` | ✅ 実装済み |
| 公開プロフィール | `/u/[id]` | ✅ 実装済み（認証不要で閲覧可・RLSで公開制御） |
| 会話（求職者側） | `/mypage/conversations/[id]` | ✅ 実装済み（リアルタイムメッセージ） |

### 企業側（/biz）

| ページ | パス | 状態 |
|--------|------|------|
| 企業認証 | `/biz/auth` | ✅ 実装済み |
| ダッシュボード | `/biz/dashboard` | ✅ 実装済み（ActivityList・PendingMeetings・TeamMembers） |
| 企業情報編集 | `/biz/company` | ✅ 実装済み（自動保存・Storage連携） |
| 求人管理 | `/biz/jobs` | ✅ 実装済み（CRUD・応募数表示） |
| 面談管理 | `/biz/meetings` | ✅ 実装済み |
| 応募管理 | `/biz/applications` | ✅ 実装済み（採用確定フロー・10%請求額算出） |
| 候補者サーチ | `/biz/candidates` | ✅ 実装済み（`ow_users.visibility=public`のみ表示・フィルター） |
| 会話（企業側） | `/biz/conversations` | ✅ 実装済み |
| 分析 | `/biz/analytics` | ✅ 実装済み（KPI・ファネル・バーチャート。現状DBデータ0件） |
| ストーリー投稿 | `/biz/posts` | ✅ 実装済み（Wantedly風・外部リンク + 記事作成2タブ） |
| メンバー管理 | `/biz/members` | ✅ 実装済み |

### 管理者向け（/admin）

| ページ | 状態 |
|--------|------|
| ダッシュボード（KPI4枚） | ✅ |
| 企業管理 | ✅ |
| 求人管理 | ✅ |
| メンター管理 | ✅ |
| 候補者管理 | ✅ |
| 記事管理（user_id紐づけUI含む） | ✅ |
| 企業担当者管理（アンバサダートグル） | ✅ |
| キャリア編集（`/admin/career/[userId]`） | ✅ |
| ユーザー招待（jobseeker / biz） | ✅ |
| 口コミ承認UI | ❌ **未実装**（DBテーブルはあるが管理UIなし） |
| 給与データ承認UI | ❌ **未実装**（DBテーブルはあるが管理UIなし） |

---

## 2. 各画面の内容詳細

### `/companies`（企業一覧）

- 企業カード（ロゴ/グラデーション・社名・tagline・フェーズ・リモート種別・平均年収・OPINIO取材バッジ・X名登録中バッジ）
- フィルター: 業種グループ（8カテゴリに集約）・成長フェーズ・勤務形態・外資系・ユニコーン・面談受付中
- 検索バー: テキスト検索
- ソート: デフォルト・社名・平均年収・社員数
- 右上: 「スワイプで探す」ボタン → `/companies/swipe`
- 「気になり」ハートボタン → `/api/bookmarks` POST（未認証時は `/auth` リダイレクト）
- 比較ボタン: `CompaniesClient.tsx` に実装があるが、**`/companies/page.tsx` は `CompaniesClient.tsx` を使っておらず** `CompanyCardList` / `CompanySearchBar` 等の別コンポーネントを使用。`CompareBar` は `/companies` ページから呼び出されていない（**エントリーポイント未接続**）

### `/companies/swipe`

- ダークUI（`#0f172a` 背景）
- カード1枚ずつ表示: 企業名・業種・フェーズ・勤務形態・平均年収・面談受付中バッジ
- 右スワイプ = 気になり（`/api/bookmarks` POST）、左スワイプ = スキップ
- ♥/✕ ボタンでも操作可
- プログレスバー表示
- 全件完了後: 「チェック完了！」画面 + 気になりリストへのリンク

### `/companies/compare`

- 最大3社の比較テーブル（CompareClient.tsx 実装済み）
- `localStorage` + `CustomEvent('compare-update')` でクロスコンポーネント状態同期
- **現状の問題**: 企業一覧ページから比較に追加する導線が未接続（`CompaniesClient.tsx` はレンダリングされていない）

### `/companies/[id]`（企業詳細）

- Heroセクション: 企業名・tagline・フェーズ・リモート・平均年収・平均年齢・設立年数など
- セクション一覧（Sticky Nav）: 概要・製品・顧客事例・組織体制・数値・福利厚生・求人・社員・記事
- `口コミ・評価`セクション: `ow_company_reviews` から `is_approved=true` のみ表示（平均スター・内訳表示）
- `給与データ`セクション: `ow_salary_reports` から `is_approved=true` の集計表示（件数・平均年収・職種別）
- 現役社員・OB/OGセクション: `ow_experiences.company_id` 参照
- カジュアル面談CTA: warm orangeグラデーションボタン
- 求人埋め込みカード: `ow_jobs`から当該会社の求人一覧

### `/jobs`（求人一覧）

- ページヘッダー: navy グラデーション（求人数・企業数・先輩OB数）
- 左サイドバー（≥1024px）: 職種・勤務形態・年収下限・雇用形態・地域・折りたたみ可
- カード: タイトル・会社名・職種タグ（DEPT_SHORT省略あり）・勤務形態・給与（green太字）・先輩alumni strip
- 面談受付中のみトグル（meetingCount表示付き）
- 求人ロールと先輩職種のマッチング（`JOB_TO_ROLE_NAMES` マッピング）
- 「気になる」ハートボタン（常時ピンク、ブックマーク連動）
- プログレスバー（N/M件表示中）
- もっと見る: ページネーション（15件単位）

### `/mentors`（メンター一覧）

- メンターカード: 写真（`photo_url`）・名前・現職・ロールタグ・相談件数・受付中パルスドット
- フィルター: 職種・相談テーマ
- 現在登録: 13名（実名・実写真）

### `/u/[id]`（公開プロフィール）

- 2カラムレイアウト（メイン + サイドバー sticky）
- メイン: カバー+アバター・About Me・スキル・経歴タイムライン
- サイドバー: 現在の在籍企業カード・スキルチップ・SNSリンク
- 「転職検討中」バッジ（`is_open_to_work=true` 時）
- OPINIO掲載記事（`ow_articles.user_id`紐づけ）
- 発信コンテンツ（`ow_user_content_links`）
- 公開制御: `ow_users.visibility`（public/login_only/private）でRLS制御
- オーナー本人のみ: プロフィール完成度ガイド表示

### `/people`（話せる人）

- アンバサダー（`ow_company_admins.is_ambassador=true`）: 名前・会社名・役職・話せるテーマ・カジュアル面談ボタン
- 「先輩ユーザー」（`ow_users`の公開ユーザー一覧）
- 企業フィルター付き

### オンボーディング（`/onboarding`）

- **3ステップ**（スキップ可能: 「後で設定する」ボタンで `onboarding_completed=true` セット）
  1. 職種（`job_type`）: カテゴリ7種 → サブ職種（全20職種: `src/lib/constants/jobTypes.ts`）
  2. 経験年数（`experience_years`）: 1〜2年 / 3〜5年 / 6〜10年 / 11年以上
  3. 悩み（`worry`）: 転職すべきか迷っている / 年収を大幅に上げたい / 外資・グローバル企業に行きたい / キャリアチェンジを考えている / スタートアップに興味がある / まず話を聞いてみたい

---

## 3. データモデル（全カラム）

### `ow_companies`（主要カラム、約95カラム）

| カラム名 | 型 | 説明 |
|----------|-----|------|
| id | UUID PK | |
| name | TEXT | 企業名（「株式会社」含む） |
| tagline | TEXT | キャッチコピー |
| mission | TEXT | ミッション |
| description | TEXT | 企業説明 |
| industry | TEXT | 業種（フリーテキスト） |
| phase | TEXT | 成長ステージ（seed/シリーズA/上場/listed等、英日混在） |
| employee_count | INT | 従業員数 |
| founded_year | INT | 設立年 |
| avg_salary | TEXT | 平均年収（テキスト形式、例: "800〜1200万円"） |
| avg_age | TEXT | 平均年齢 |
| female_ratio | TEXT | 女性比率 |
| logo_url | TEXT | ロゴURL（Supabase Storage） |
| logo_gradient | TEXT | ロゴ背景グラデーション（CSSグラデーション文字列） |
| logo_letter | TEXT | ロゴ代替文字 |
| brand_name | TEXT | ブランド名（Salesforce等、legal nameと異なる場合） |
| location | TEXT | 所在地 |
| url | TEXT | 公式サイトURL |
| remote_work_status | TEXT | remote/hybrid/on_site等 |
| flex_time | BOOL | フレックスタイム制 |
| side_job_ok | BOOL | 副業可 |
| accepting_casual_meetings | BOOL | カジュアル面談受付中 |
| is_published | BOOL | 公開フラグ |
| is_ambassador | BOOL | ※`ow_company_admins`側のカラム |
| fit_positives | TEXT[] | 「合う人」ポジティブ要素 |
| fit_negatives | TEXT[] | 「合わない人」ネガティブ要素 |
| why_join | TEXT | 入社理由 |

### `ow_jobs`

| カラム名 | 型 | 説明 |
|----------|-----|------|
| id | UUID PK | |
| company_id | UUID FK | `ow_companies.id` |
| title | TEXT | 求人タイトル |
| job_category | TEXT | 職種（フリーテキスト） |
| employment_type | TEXT | 正社員/契約社員等 |
| work_style | TEXT | リモート/ハイブリッド等 |
| location | TEXT | 勤務地 |
| salary_min | INT | 年収下限（万円） |
| salary_max | INT | 年収上限（万円） |
| description | TEXT | 業務内容 |
| requirements | TEXT | 必須要件 |
| preferred_skills | TEXT | 歓迎スキル |
| catch_copy | TEXT | キャッチコピー（カード表示用） |
| one_liner | TEXT | 1行説明 |
| selection_process | TEXT | 選考フロー |
| status | TEXT | published/draft/closed |
| published_at | TIMESTAMPTZ | 掲載日 |
| remote_work_status | TEXT | フルリモート/ハイブリッド等 |

### `ow_users`（求職者アイデンティティ）

| カラム名 | 型 | 説明 |
|----------|-----|------|
| id | UUID PK | |
| auth_id | UUID | `auth.users.id`参照 |
| name | TEXT | 表示名 |
| email | TEXT | |
| avatar_color | TEXT | グラデーション文字列 |
| avatar_url | TEXT | 写真URL |
| visibility | TEXT | public/login_only/private（デフォルト: public） |
| is_mentor | BOOL | メンター兼任フラグ |
| is_open_to_work | BOOL | 転職検討中フラグ |

### `ow_profiles`（求職者キャリア設定、`ow_users`とは別テーブル）

| カラム名 | 型 | 説明 |
|----------|-----|------|
| user_id | UUID FK | `auth.users.id`参照 |
| name | TEXT | |
| name_kana | TEXT | |
| location | TEXT | |
| job_type | TEXT | 職種（オンボーディング入力） |
| experience_years | TEXT | 経験年数（オンボーディング入力） |
| desired_salary_min | INT | 希望年収下限 |
| desired_salary_max | INT | 希望年収上限 |
| desired_work_style | TEXT | 希望勤務形態 |
| desired_phase | TEXT[] | 希望フェーズ（複数選択） |
| transfer_timing | TEXT | 転職時期 |
| skills | TEXT[] | スキル |
| tools | TEXT[] | 使用ツール |
| bio | TEXT | 自己紹介 |
| photo_url | TEXT | |
| worry | TEXT | 悩み（オンボーディング入力） |
| onboarding_completed | BOOL | |

### `ow_experiences`（職歴）

| カラム名 | 型 | 説明 |
|----------|-----|------|
| id | UUID PK | |
| user_id | UUID FK | `ow_users.id` |
| company_id | UUID FK | `ow_companies.id`（マスタ紐づけ時） |
| company_text | TEXT | 自由入力企業名 |
| is_current | BOOL | 現職フラグ |
| role_category_id | UUID FK | `ow_roles.id` |
| salary_man | INT | 年収実数（非表示デフォルト） |
| visibility_company | TEXT | real/masked/hidden（デフォルト: masked） |
| visibility_salary | BOOL | 年収公開フラグ（デフォルト: false） |
| visibility_reason | BOOL | 転職理由公開フラグ（デフォルト: true） |

### `ow_mentors`

| カラム名 | 型 | 説明 |
|----------|-----|------|
| id | UUID PK | |
| user_id | UUID FK | `ow_users.id`（NULL: 全メンターにNULLが入っているバグあり） |
| name | TEXT | |
| photo_url | TEXT | Supabase Storage URL |
| bio | TEXT | |
| catchphrase | TEXT | |
| current_company | TEXT | 現職企業名（フリーテキスト） |
| current_role | TEXT | 現職役職（"supabase_read_only_user"バグあり、`roles[0]`で代替） |
| roles | TEXT[] | 職種ロール配列 |
| question_tags | TEXT[] | 相談テーマ |
| concerns | TEXT | 対応できる悩み |
| is_available | BOOL | 受付中フラグ |

### `ow_company_reviews`（Migration 208）

| カラム名 | 型 | 説明 |
|----------|-----|------|
| id | UUID PK | |
| company_id | UUID FK | |
| user_id | UUID FK | `ow_users.id` |
| employment_status | TEXT | current/alumni |
| rating_overall | SMALLINT 1-5 | 総合（必須） |
| rating_culture | SMALLINT 1-5 | 文化・雰囲気（任意） |
| rating_growth | SMALLINT 1-5 | 成長機会（任意） |
| rating_wlb | SMALLINT 1-5 | ワークライフバランス（任意） |
| rating_compensation | SMALLINT 1-5 | 報酬水準（任意） |
| pros | TEXT | よいと思う点 |
| cons | TEXT | 改善を希望する点 |
| job_type | TEXT | 職種 |
| is_approved | BOOL | 承認フラグ（デフォルト: false） |
| UNIQUE | | (company_id, user_id) — 1人1社1件 |

**制約**: 承認が必要だが管理者承認UIは未実装。

### `ow_salary_reports`（Migration 209）

| カラム名 | 型 | 説明 |
|----------|-----|------|
| id | UUID PK | |
| company_id | UUID FK | |
| user_id | UUID FK | `ow_users.id`（任意） |
| job_type | TEXT | 職種 |
| years_of_experience | SMALLINT 0-50 | 経験年数 |
| annual_salary | INT | 年収（200万〜1億、円単位） |
| employment_status | TEXT | current/alumni |
| is_approved | BOOL | 承認フラグ（デフォルト: false） |

**制約**: 承認が必要だが管理者承認UIは未実装。

### `ow_career_profiles`（Migration 175）

| カラム名 | 型 | 説明 |
|----------|-----|------|
| user_id | UUID PK/FK | |
| headline | TEXT | |
| years_of_experience | INT | |
| is_published | BOOL | デフォルト: false |

**注意**: テーブルはDBに存在するが、`/career-trajectories` のフロントエンドページは**存在しない**。

### `ow_job_applications`（応募）

| カラム名 | 型 | 説明 |
|----------|-----|------|
| id | UUID PK | |
| job_id | UUID FK | |
| user_id | UUID FK | `auth.users.id` |
| status | TEXT | pending/reviewing/rejected/accepted/hired |
| hired_confirmed_at | TIMESTAMPTZ | 採用確定日時 |
| hired_salary | INT | 採用時年収（万円） |

### `ow_casual_meetings`

| 状態 | 実データ0件 |
|------|------------|

### `ow_mentor_reservations`

- Migration 197 ファイルあり（`supabase/migrations/197_create_mentor_reservations.sql`）
- **Supabase本番への適用状況は確認していない**

### `ow_match_scores`

- テーブルは存在するが**本番データ0件**
- `weekly-match` cronは実際には使用しておらず、`getDefaultReason(job)`で固定テキストを返す（後述）

---

## 4. 求人分類・業界タクソノミー

### 職種分類（`src/lib/constants/jobTypes.ts`）

20職種、7カテゴリで構成:

| カテゴリ | 職種 |
|----------|------|
| 営業・セールス | フィールドセールス、インサイドセールス、カスタマーサクセス、アカウントマネージャー |
| マーケティング | マーケター、PR・広報 |
| プロダクト | プロダクトマネージャー、プロダクトデザイナー |
| エンジニアリング | バックエンドエンジニア、フロントエンドエンジニア、インフラ・SRE |
| ビジネス開発 | 事業開発・BizDev、コーポレート、HR・人事、財務・経理 |
| コンサルティング | プリセールス・SE |
| コーポレート | 法務・コンプライアンス、広報・マーケ（コーポレート）、経営・経営企画 |

### 業種グループ（`src/lib/search/industryGroups.ts`）

38以上の業種タグを8カテゴリに集約:

- SaaS・クラウド
- フィンテック・金融
- HR・採用テック
- 医療・ヘルスケア
- 建設・不動産テック
- EC・コマース
- コンサル・SI
- その他IT

### 企業フェーズ分類（`PHASE_FILTER_MAP`）

英語・日本語混在をマッピングで統合:

- 成長ステージ: seed/シード/シリーズA/series_a/series-a/シリーズB/series_b/シリーズC/series_c
- 上場: listed/上場
- ユニコーン: unicorn/ユニコーン
- 大手/エンタープライズ: enterprise/大手/エンタープライズ

---

## 5. 報酬データ構造

### 表示レイヤー（企業詳細ページ `/companies/[id]`）

#### 給与データセクション（`SalaryData`）
- `ow_salary_reports` から `is_approved=true` かつ当該 `company_id` のレコードを取得
- 集計して表示: 件数・平均年収・職種別内訳
- **現状**: `is_approved=false` がデフォルトのため、管理者承認なしには表示されない
- 管理者承認UIは**未実装**

#### `ow_companies.avg_salary`
- テキスト形式（例: "800〜1200万円"）で企業が手動入力
- 企業カード・スワイプUI・求人詳細などで参照

#### 求人給与（`ow_jobs`）
- `salary_min` / `salary_max`: 整数（万円）
- フォーマット: `formatSalary(min, max)` → "400〜800万円"

#### 職歴給与（`ow_experiences.salary_man`）
- 整数（円単位）
- `visibility_salary=false` がデフォルト → 公開設定しない限りプロフィールに表示されない
- anon ユーザーへのSELECT権限は列単位で剥奪済み（Migration 177）

---

## 6. マッチング・レコメンドの実態

### `ow_match_scores` テーブル
- DBテーブルは存在する
- **本番データ: 0件**
- 週次cronジョブ（`/api/cron/weekly-match`）が実行されるが、`ow_match_scores`を参照せず

### `weekly-match` cronの実際の動作

```
1. ow_profiles（job_type設定済み・notify_emailあり）のユーザーを取得
2. ow_jobs（published）を取得
3. ow_match_scores に0件のため、getDefaultReason(job) を呼び出す
4. getDefaultReason は job.job_category に基づいてカテゴリ固定テキストを返す:
   - 営業系  → "SaaS営業の経験が活かせるポジションです"
   - CS系    → "CS経験とSaaSプロダクト理解がマッチしています"
   - マーケ系 → "BtoBマーケの経験が直結するポジションです"
   - その他  → "あなたのスキルセットにマッチする求人です"
5. 全ユーザーに同じ求人を同じ固定テキストで週次メール送信
```

**結論: パーソナライズされたマッチングは現状未実装。職種カテゴリ別の固定テキストを全ユーザーに配信している。**

### `dead code`（削除済み）
- `src/lib/matching.ts`（`generateMatchReasons()`）: 呼び出し元0件のため削除済み（2026-07-08）
- `src/lib/utils/matchReason.ts`（`getMatchReason()`）: 呼び出し元0件のため削除済み（2026-07-08）

---

## 7. 「第三者視点」機能の実装状況

### OPINIO独自の「取材」コンテンツ

| 機能 | 実装状況 |
|------|---------|
| 記事（`ow_articles`）| ✅ 実装済み・16件（うち8件はcompany_id紐づけあり） |
| 企業詳細の取材情報（`EvaluationText`・`fit_positives/negatives`） | ✅ 実装済み（管理者が手動入力） |
| 「OPINIO取材済み」バッジ（`ow_articles.company_id`から集計） | ✅ 実装済み |
| ストーリー投稿（`ow_company_posts`・企業発信コンテンツ） | ✅ 実装済み（企業担当者が投稿・編集） |

### 「話せる人」機能

| 機能 | 実装状況 |
|------|---------|
| メンター（`ow_mentors`）: 元社員・有識者 | ✅ 13名登録済み |
| アンバサダー（`ow_company_admins.is_ambassador=true`）: 企業の採用担当 | ✅ 実装済み（/peopleページ） |
| 現役社員・OB/OG（`ow_experiences.company_id`参照）| ✅ 企業詳細ページに表示 |

### ユーザー口コミ・評価（`ow_company_reviews`）

- **フォーム**: 企業詳細ページに口コミ投稿フォームあり（要認証）
- **表示**: `is_approved=true` のみ表示
- **管理承認UI**: ❌ 未実装（Supabase SQL Editorでの手動承認のみ可能）

### 給与データ（`ow_salary_reports`）

- **フォーム**: 企業詳細ページに給与報告フォームあり（要認証）
- **表示**: `is_approved=true` のみ表示（職種別集計）
- **管理承認UI**: ❌ 未実装

---

## 8. 現状サマリー

### DB実データ（2026-07-10時点の確認範囲）

| テーブル | 実データ件数 | 備考 |
|---------|------------|------|
| `ow_companies` | 79社（is_published=true） | 複数フェーズ・業種 |
| `ow_jobs` | ~200件以上（Salesforce 106件等） | status=published |
| `ow_mentors` | 13名 | 全員写真あり |
| `ow_users` | 100名以上 | |
| `ow_articles` | 16件 | 全件is_published=true |
| `ow_company_reviews` | 0件（is_approved=true） | テーブルあり |
| `ow_salary_reports` | 0件（is_approved=true） | テーブルあり |
| `ow_match_scores` | 0件 | マッチングデータなし |
| `ow_casual_meetings` | 0件 | |

### 主要な「未実装・不完全」一覧

| 項目 | 状態 |
|------|------|
| `/career-trajectories` ページ | DBテーブルあり・フロントエンドページなし |
| 企業比較（CompareBar）のエントリーポイント | `CompaniesClient.tsx`に実装あり・`/companies/page.tsx`から未呼び出し |
| 口コミ・給与データの管理者承認UI | DBテーブルあり・adminページなし |
| パーソナライズマッチング | `ow_match_scores`は0件・固定テキスト配信のみ |
| `ow_mentor_reservations` テーブル | Migration 197ファイルあり・本番適用状況未確認 |
| `ow_mentors.user_id` | 全件NULLのバグあり（`ow_users`との紐づけ未設定） |
| `ow_mentors.current_role` | 全件 "supabase_read_only_user" のバグあり（`roles[0]`で代替中） |
