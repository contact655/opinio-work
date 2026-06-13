# Opinio — Claude 作業ログ

## プロジェクト概要

IT/SaaS 業界に特化したキャリアプラットフォーム。
**求職者側プロダクト（Phase 2 + Phase 4）が 2026-04-24 に 100% 完成。**

- **リポジトリ**: `/Users/hisato/opinio-work/`
- **プレビューサーバー**: `localhost:3000`（`npm run dev` from `/Users/hisato/opinio-work/`）
- **launch.json**: `/Users/hisato/opinio-work/.claude/launch.json`
- **モックHTML + 仕様書**: `/Users/hisato/opinio-mock/`
- **仕様書**: `/Users/hisato/opinio-mock/OPINIO_IMPLEMENTATION_SPEC.md`

---

## 🎯 次のセッションでやること（2026-06-13 セッション20 更新）

### ✅ 完了 2026-06-13 セッション20: LP 9項目 UX 改善 + medimo 新規企業追加

  **株式会社medimo 新規追加（Migration 169）:**
  - `supabase/migrations/169_add_medimo.sql` — 企業プロフィール + 25件求人
  - Medical AI・シリーズA・東京都港区（虎ノ門33森ビル）・設立2022年・ハイブリッド
  - 25ポジション: ML Engineer / Full Stack / Mobile / SRE / VPoE / EM / UI/UX Designer / 営業 / BizDev / コーポレート 等
  - Source: https://hrmos.co/pages/medimo/jobs / https://recruit.medimo.ai/
  - ⚠️ **手動適用が必要**: Supabase SQL Editor で `supabase/migrations/169_add_medimo.sql` を実行

  **LP（`src/app/(jobseeker)/page.tsx`）9項目改善（commit `860ccb8`）:**
  - ① h1: "外資・SaaSの転職は、深く知ってから動く。" 2行・`clamp(28px,3.8vw,46px)`
  - ② eyebrow: "外資系 IT・SaaS・スタートアップに特化"
  - ③ StatsStrip（79社・155件）削除 → 数字を出さない方針
  - ④ lead text: 「登録不要」「現役社員に直接」をアンバー強調
  - ⑤ trust pills 追加: 完全無料 / 営業電話なし / 登録はメールのみ（hero 下部）
  - ⑥ TrustStrip コンポーネント追加（Hero直後）: メンター円形写真オーバーラップ + 信頼シグナル3点
  - ⑦ PainPoints: 2ゾーンカード（問題=白背景 red icon / OPINIOなら=royal-50 背景）
  - ⑧ HowItWorks: 背景に大きなステップ番号（opacity 0.04 ウォーターマーク）
  - ⑨ FinalCta: amber/orange を primary に、ghost を secondary に（ビズリーチ等競合と同等の視認性）

### 🟢 次の優先候補（2026-06-13 セッション20後）
- **Migration 168 の手動適用** — Archi Village 18求人表示
- **Migration 169 の手動適用** — medimo 25求人表示
- **実ユーザー招待・オンボーディング** — DB・機能・UI 全て準備完了

---

## 🎯 次のセッションでやること（2026-06-13 セッション19 更新）

### ✅ 完了 2026-06-13 セッション19: Archi Village 企業情報・求人データ充実 + Jobs UX 6改善のESLint修正

  **Jobs UX fix（セッション18後継続）:**
  - Vercel ビルドエラー修正: `timeAgo`・`badge`・`postingLabel` の未使用変数を削除（commit `c41561f`）
  - `brand_name` フィールド追加: `ow_companies` + `queries.ts` + `JobsClient.tsx`（commit `9d59f6f`）
  - Migration 167: `brand_name TEXT` カラム追加、Salesforce/HubSpot/Datadog/Timee の brand_name 設定（手動適用済み）

  **Migration 168: Archi Village データ充実（`supabase/migrations/168_archi_village_enrichment.sql`）:**
  - ow_companies UPDATE:
    - phase: null → `IPO準備中`
    - remote_work_status: on_site → `hybrid`
    - avg_salary: 600万円, avg_age: 30歳
    - fit_positives: 4項目（IPO経験・SO・ConTech市場・未経験OK）
    - fit_negatives: 3項目（顧客教育コスト・スタートアップ変化・フィールド営業中心）
    - why_join・description を刷新（累計調達17億円、時価総額1500億円目標、アーキLink年商10億円超）
  - ow_jobs INSERT: 18件（HERPから全ポジション）
    - 営業4件（27卒・東京・大阪・マネージャー候補）
    - エグゼクティブ2件（CFO ¥1500万〜SO1.0%、CPO ¥1800万〜SO1.5%）
    - カスタマーサクセス2件、コーポレート4件（部長・採用・総務・広報）、経理2件、事務・マーケ2件、オープン1件
  - Source: https://archi-village.com/recruit + https://herp.careers/v1/archirecruit
  - ⚠️ **手動適用が必要**: Supabase SQL Editor で `supabase/migrations/168_archi_village_enrichment.sql` を実行

### 🟢 次の優先候補（2026-06-13 セッション19後）
- **Migration 168 の手動適用** — Supabase ダッシュボードで実行後、Archi Village に18求人が表示される
- **実ユーザー招待・オンボーディング** — DB・機能・UI 全て準備完了
- **`ow_articles` の残り8件 company_id 設定** — LayerX等を ow_companies に追加すれば自動表示

---

## 🎯 次のセッションでやること（2026-06-13 セッション18 更新）

### ✅ 完了 2026-06-13 セッション18: 求人一覧ページ 10 UX改善（競合比較）

  **`/jobs` 求人一覧（`JobsClient.tsx`）10項目:**
  - ① ページヘッダー追加: navy グラデーションバンド（`h1`「IT / SaaS 求人を探す」+ 求人数・企業数・先輩OB）
  - ② alumni strip フォールバック削除: `alumni.length > 0` の時のみ表示、空カードのノイズ除去
  - ③ サイドバーアコーディオン: `SidebarFilters` 内に `collapsed: Set<string>` state 追加、各セクション折りたたみ可能（職種・勤務形態=デフォルト展開、年収・雇用形態・地域=デフォルト折りたたみ）
  - ④ 凡例追加: 面談受付中トグル下に「カード左のオレンジ枠が対象企業」legend（orange square icon）
  - ⑤ 気になるボタン常時ピンク化: 非ブックマーク時も `#FFF5F5` 背景 + `#F87171` ハート（デフォルトグレーを廃止）
  - ⑦ プログレスバー: 「もっと見る」テキストカウンター → 視覚的プログレスバー（royal gradient + 「N / M 件表示中」テキスト）
  - ⑧ タイトル1行クランプ: `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; minWidth: 0` でカード高さ統一
  - ⑨ グルーピング通知をインラインチップに: 全幅オレンジバナーを削除 → 並び替えバー行末に「1社3件まで（N件非表示）」＋「全表示」ボタン
  - ⑩ alumni strip を大きく目立つデザインに: royal グラデーション背景 + 26px アバター（-8px overlap） + 「生藤さん・小松さんが先輩にいます 話を聞く →」
  - ⑥ hover preview パネルは変更なし（≥1440px で既に機能）

  **変更ファイル:** `JobsClient.tsx` のみ（+222行 -146行）

### 🟢 次の優先候補（2026-06-13 セッション18後）
- **実ユーザー招待・オンボーディング** — DB・機能・UI 全て準備完了
- **`ow_articles` の残り8件 company_id 設定** — LayerX等を ow_companies に追加すれば自動表示

---

## 🎯 次のセッションでやること（2026-06-12 セッション17 更新）

### ✅ 完了 2026-06-12 セッション17: 求人一覧ページ 8 UX改善

  **`/jobs` 求人一覧（`JobsClient.tsx`）8項目:**
  - カード情報階層: タイトルを 17px / weight 800 に大型化（明確な視覚的優先度）
  - alumni strip 高さ統一: 先輩なしカードにもフォールバックストリップ（「社員・OBの経歴を見る」）追加
  - 職種タグ省略修正: `DEPT_SHORT` マッピング追加（「プロフェッショナルサービス」→「プロサービス」等 10種）、maxWidth truncation 削除
  - デスクトップサイドバーフィルター: 220px sticky左サイドバー（≥1024px）、`SidebarFilters` コンポーネント新規作成
  - アクティブフィルター状態可視化: 各フィルターのアクティブ時スタイル（royal bg + bold）
  - グルーピング通知を先頭に移動: オレンジ（warm）スタイルでリスト最上部に表示
  - 面談受付中のみトグル: `meetingOnly` state + `meetingCount` 表示付きトグルスイッチ
  - モバイルカード圧縮: highlight テキスト・padding 削減（`job-list-mobile-hide` クラス）

  **CSS 追加（`globals.css` 内 style タグ）:**
  - `@media (min-width: 1024px)`: `.jobs-layout` → 2カラム grid、`.jobs-filter-chips-row` 非表示
  - `@media (max-width: 767px)`: `.job-list-mobile-hide` 非表示
  - hover preview panel を 1440px+ に引き上げ（サイドバーとのオーバーラップ防止）

  **デバッグ:**
  - `.next` キャッシュ起因の React hydration error（`<button> in <div>`）→ `rm -rf .next` + dev server 再起動で解消

### 🟢 次の優先候補（2026-06-12 セッション17後）
- **実ユーザー招待・オンボーディング** — DB・機能・UI 全て準備完了
- **`ow_articles` の残り8件 company_id 設定** — LayerX等を ow_companies に追加すれば自動表示

---

## 🎯 次のセッションでやること（2026-06-12 セッション16 更新）

### ✅ 完了 2026-06-12 セッション16: 求人ページ ロールベース先輩マッチング

  **`/jobs` 求人一覧: 職種マッチング先輩表示（`queries.ts`, `jobs/page.tsx`, `JobsClient.tsx`）:**
  - `getCompanyAlumniMap`（会社単位）→ `getJobAlumniMap`（求人単位）に完全刷新
  - `JOB_TO_ROLE_NAMES` マッピング追加: `ow_jobs.job_category`（フリーテキスト）→ `ow_roles.name`（営業/マーケ/CS等）
  - `ow_experiences.role_category_id` FK → `ow_roles` 階層で親ロールまで遡って照合
  - ロール一致する先輩を優先表示、一致者ゼロの場合は全先輩にフォールバック
  - 結果: Salesforce 求人「Account Executive」→ 生藤弘樹 + 小松耕野（営業系）が「先輩2名がいます」に表示
  - alumni lookup key を `job.company_id` → `job.id` に変更（`JobsClient.tsx`）

  **デバッグ:**
  - `.next` キャッシュ起因の prod/dev React バージョンミスマッチ（RSC payload error）→ `rm -rf .next` で解消
  - Vercel ビルドエラー（ESLint: 未使用 `Pagination` 関数、`orderedKeys`, `categoryLabel`）→ 削除・`_` prefix で修正

### 🟢 次の優先候補（2026-06-12 セッション16後）
- **実ユーザー招待・オンボーディング** — DB・機能・UI 全て準備完了
- **`ow_articles` の残り8件 company_id 設定** — LayerX等を ow_companies に追加すれば自動表示

---

## 🎯 次のセッションでやること（2026-06-12 セッション15 更新）

### ✅ 完了 2026-06-12 セッション15: 企業詳細ページ 15 UX改善（Salesforceページ参照）

  **企業詳細ページ（`/companies/[id]/page.tsx` 他4ファイル）15項目:**
  - Hero: 設立年 stat 削除（3項目に絞り込み）、ShareButton前に縦セパレーター追加
  - 福利厚生: ピルリスト → カードグリッド（auto-fill 160px、アイコン付き）
  - EvaluationText: 長文テキストを最初の2文箇条書きプレビュー＋「続きを読む」に変更
  - OB/OG キャッチフレーズ: グラデーション背景 + "コメント" ラベル + 大きな引用アイコン
  - 記事セクション（1件）: 60%記事カード + 40%「もっと知る」CTAパネルの2カラムに変更
  - 記事セクション（2件以上）: オーバーレイ不透明度を rgba(.38) → rgba(.18) に軽量化
  - NEXT STEP: ボタン順序入れ替え（求人=オレンジ主、面談=ロイヤル副）
  - JobEmbedCard: catchCopy 未設定時 description 先頭100字をフォールバック表示
  - OrgTeams: 展開ボタンにチーム名プレビュー「残りNチーム：チーム名1 / チーム名2...」追加
  - OrgTeams: 「すべてを見る」ボタン → ロイヤル塗りつぶし＋シャドウ
  - CustomerCasesClient: BoldNumbers コンポーネント（数値・単位を緑太字に）
  - CustomerCasesClient: 製品ピル色をカテゴリ別（sales=royal / marketing=amber / service=green / analytics=purple）
  - ProductsClients: セクション末尾に求人CTAリンク（warm amber スタイル）
  - 中間CTA: 福利厚生後 + 組織体制後の2箇所にインラインCTAバナー追加
  - Migration 166: Salesforce Japan 106件求人を ow_jobs に追加

  **デバッグ:**
  - `.next` キャッシュ起因のランタイムクラッシュ（`TypeError: Cannot read properties of undefined`）を解決
  - 原因: dev サーバー長期稼働による古いコンパイルキャッシュ / `rm -rf .next` + 再起動で解消

### 🟢 次の優先候補（2026-06-12 セッション15後）
- **実ユーザー招待・オンボーディング** — DB・機能・UI 全て準備完了
- **`ow_articles` の残り8件 company_id 設定** — LayerX等を ow_companies に追加すれば自動表示

---

## 🎯 次のセッションでやること（2026-06-08 セッション14 更新）

### ✅ 完了 2026-06-08 セッション14: 企業詳細ページ可読性改善 + `/u/[id]` バグ修正

  **企業詳細ページ（`/companies/[id]/page.tsx`）可読性大幅改善:**
  - 青いセクションヘッダーバンドを全セクションから削除（background #f5f8ff → borderBottom のみ）
  - Heroカバー高さ 240→200px に短縮
  - Hero stats: 4カードグリッド → コンパクトなインラインストリップ（アイコン+ラベル+値、区切り線区切り）
  - 数値セクション: NULL値のセルを非表示に（filledItems フィルタリング）、動的グリッドカラム数
  - Sticky nav: より短いラベル、空のタブを非表示（製品・顧客、組織、数値、福利厚生、求人、社員、記事）

  **`/u/[id]` プロフィールページ: 致命的バグ修正:**
  - 原因: Server Component 内で `onMouseEnter`/`onMouseLeave` イベントハンドラーが使われていた
  - 影響: Suspense バウンダリが解決されず、プロフィールが表示されない（ローディングスケルトンが永続表示）
  - 修正: 2箇所のイベントハンドラーを CSS クラス（`.u-sidebar-link:hover`・`.u-content-card:hover`）に置換
  - 副次効果: `転職検討中`バッジ（Migration 146 で追加済み `is_open_to_work`）も正常に表示されることを確認

  **`ow_articles.company_id` 紐づけ調査:**
  - 16記事のうち8件は既に company_id 設定済み（Salesforce, HubSpot, Archi Village, irodas, Opinio, Timee, Translead, Shinka）
  - 残り8件（LayerX×2, SmartHR×2, Sansan, PKSHA, Ubie, freee）は ow_companies に企業が存在しないためリンク不可
  - 8件のバッジは企業詳細ページで自動表示される

### 🟢 次の優先候補（2026-06-08 セッション14後）
- **Migration 146 の手動適用確認** ✅ 適用済み（Supabase ダッシュボードで実行確認済み）
- **実ユーザー招待・オンボーディング** — DB・機能・UI 全て準備完了
- **`ow_articles` の残り8件 company_id 設定** — LayerX等を ow_companies に追加すれば自動表示

---

## 🎯 次のセッションでやること（2026-06-03 セッション13 更新）

### ✅ 完了 2026-06-03 セッション13: 転職サイトへのピボット + 3大機能着手

  **料金ページ・採用確定フロー（② マネタイズ）:**
  - `/pricing` ページ新規作成（掲載費¥0 + 成果報酬10%）
  - Migration 144: `ow_job_applications` に `hired_confirmed_at` + `hired_salary` カラム追加
  - `/biz/applications` に「採用確定」ボタン追加（年収入力 → 10%請求額算出 → 管理者メール送信）
  - `lib/business/applications.ts` に `hired` ステータス追加

  **① 求人検索UX改善（Greenっぽく）:**
  - `JobsClient.tsx`: PER_PAGE 9→15、formatSalary バグ修正（¥400–800万円 → 400〜800万円）
  - `SidebarFilter` コンポーネント: sticky sidebar、職種・勤務形態・年収下限・都道府県フィルター
  - `JobListCard` コンポーネント: desktop用横長カード
  - CSS グリッドレイアウト: desktop→サイドバー+リストカード / mobile→グリッド+上部フィルターバー

  **② 企業発信機能（Wantedly Stories）:**
  - Migration 145: `ow_company_posts` テーブル作成 ⚠️ **手動適用が必要**
    - `supabase/migrations/145_add_company_posts.sql` を Supabase ダッシュボードで実行
  - `/biz/posts/page.tsx`: 2テーブル（external_links + company_posts）を並行取得
  - `PostsClient.tsx`: 2タブ構成に全面刷新
    - 「ストーリー」タブ: 新規（Wantedly風 記事作成・編集・公開管理）
    - 「外部リンク」タブ: 既存機能をサブコンポーネントに整理
  - Server Actions 4本新規作成:
    - `createStory.ts` / `updateStory.ts` / `deleteStory.ts` / `togglePublish.ts`
  - `companies/[id]/page.tsx`: `ow_company_posts` 公開済みを fetch し「企業ストーリー」セクション追加
    - `CompanyStoriesSection` + `StoryCardPublic` コンポーネント新規作成
    - sticky nav に「ストーリー N件」タブ追加（公開ストーリーあり時のみ表示）

  **③ 公開プロフィール強化（LinkedInっぽく）:**
  - `/u/[id]` の auth redirect 削除 → 非ログインでも public プロフィールを閲覧可能に（RLSが visibility を制御）
  - Migration 146: `ow_users.is_open_to_work BOOLEAN` カラム追加 ⚠️ **手動適用が必要**
  - 「転職検討中」バッジ: `is_open_to_work=true` のとき名前の横に緑グラデーションバッジ表示
  - `ProfileShareButton` コンポーネント新規作成: URLコピー + X(Twitter)シェアボタン
    - オーナー: 編集ボタン + シェアボタン両方表示
    - 非オーナー: シェアボタンのみ（企業ページリンクと並列）
  - スキルヘッダー: カテゴリ別カラーコーディング（最大6タグ）に強化
  - `/profile/edit` アカウント設定タブに「転職検討中トグル」追加（緑のスライダーUI）
  - `PUT /api/jobseeker/profile` に `is_open_to_work` フィールド追加

### 🟢 次の優先候補（2026-06-03 セッション13後 更新）
- **Migration 146 の手動適用** — Supabase ダッシュボードで実行後、転職検討中バッジが有効になる
- **ow_articles に company_id を設定** — Admin記事管理画面でカンパニー紐づけを設定すると「OPINIO取材済み」バッジが自動表示

### ✅ 完了 2026-06-02 セッション12: 競合比較UX改善 7項目

### ✅ 完了 2026-06-02 セッション12: 競合比較UX改善 7項目

  **③ 活躍している人セクション強化（`mentors/page.tsx`）:**
  - メンター一覧カード: `roles[0]` の職種ロールを royal blue ピルタグとして追加
  - `photo_url` 円形写真・`catchphrase` は前セッションで実装済み、ロールタグを追加

  **④ 企業→メンター導線 強化（`companies/[id]/page.tsx`, `jobs/[id]/page.tsx`）:**
  - `CompanyMentorsSection`: `_companyId`/`_companyName`（未使用）→ 実際に Supabase でテキストマッチング
  - `ow_mentors.current_company ILIKE '%{company_name}%'` で企業固有メンターを取得
  - 企業固有メンターあり時は「この企業のことを知る先輩に相談」ヘッダー + "現職" バッジ
  - `ow_mentors.current_role` が "supabase_read_only_user" になっているバグを発見 → `roles[0]` で代替

  **⑤ 企業比較機能（新規3ファイル）:**
  - `src/components/companies/CompareBar.tsx` 新規作成:
    - `position: fixed; bottom: 0` (desktop) / `bottom: 64px` (mobile、ボトムナビの上)
    - `localStorage` + `CustomEvent('compare-update')` でクロスコンポーネント状態同期
    - 最大3社まで追加可能、「比較する (N社) →」ボタン
  - `src/app/(jobseeker)/companies/compare/page.tsx` 新規作成
  - `CompanyCardCompact.tsx`: 比較ボタン追加、`companies/page.tsx`: `<CompareBar />` 追加

  **⑦ 記事統合導線（`articles/[slug]/page.tsx`）:**
  - `ArticleMentorCTA` コンポーネント（記事末尾）: 3名のメンターカード + 「全員を見る →」

  **① 気になるトースト通知（全面）:**
  - `src/lib/toast.ts` グローバルトーストイベントバス新規作成
  - `src/components/ui/GlobalToast.tsx` 新規作成（jobseeker layout に配置）
  - `CompanyCardCompact.tsx`: ブックマーク時に「{企業名} を気になりリストに追加しました ♥」トースト
  - `JobsClient.tsx`: 求人ブックマーク時にトースト

  **⑥ メール通知設定 UI（`/profile/edit` アカウント設定タブ）:**
  - `NotificationSettingsSection` コンポーネント新規追加
  - 3項目: 新着企業のお知らせ / マッチング求人のお知らせ / メンター関連のお知らせ
  - トグルスイッチ UI、localStorage に保存（将来 DB 移行可能な設計）
  - 保存時「✓ 保存済み」フラッシュ表示

  **⑧ スキルマッチング（`/mypage` ブックマークタブ）:**
  - `BookmarksMentorMatch` コンポーネント新規追加
  - 気になり企業のブックマークがある場合、その企業に在籍するメンターを表示
  - `ow_mentors.current_company` テキストマッチで照合、最大3名表示
  - `/api/mentors/preview`: `?limit=N` パラメータ追加、`roles`・`catchphrase` フィールド追加

  **バグ修正:**
  - `admin/mentors/page.tsx`: 未使用 `fetchMentors` → `_fetchMentors` にリネーム（ESLint エラー解消）

  **バグ発見（継続中）:**
  - `ow_mentors.current_role` = "supabase_read_only_user"（全メンター）— `roles[0]` で代替中
  - `ow_mentors.user_id` = null（全メンター）— テキストマッチで代替中

### 🟢 次の優先候補（2026-06-02 セッション12後 更新）
- **ow_articles に company_id を設定** — Admin記事管理画面（`/admin/articles`）でカンパニー紐づけを設定すると「OPINIO取材済み」バッジが自動表示
- **実ユーザー招待・オンボーディング** — DB・機能・UI 全て準備完了
- **企業担当者による求人登録** — `/biz/jobs` から直接登録（テスト求人は削除済み）

### ✅ 完了 2026-06-02 セッション11: UI/UX 6項目全面改善

  **① Hero アニメーション削除 → 固定コピー（`page.tsx`）:**
  - `HeroRoleRotator` コンポーネント（ローテーションアニメーション）を削除
  - 固定 h1: `IT/SaaS業界の求人と企業を、先輩と話しながら選ぶ。`（amber + serif）
  - `DEFAULT_STATS` を実データに修正: `{ companies: 13, jobs: 0, mentors: 13 }`
  - jobs.length === 0 のとき求人スケルトン表示 → 正直な空状態カード（🏗️）に変更

  **② 企業カード: 多色グラデーション → navy 統一（`CompanyCardCompact.tsx`）:**
  - `PLACEHOLDER_COLORS`（6色パステル）を削除
  - `NAVY_PLACEHOLDER = { bg: 'linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)', text: 'rgba(255,255,255,0.85)' }` に統一
  - 全企業ロゴなし（`logo_url = null`）のため全カードに適用 → 統一感ある navy ヘッダー

  **③ モバイルボトムナビ追加（`MobileBottomNav.tsx` 新規作成）:**
  - 5タブ: 企業 / 求人 / 先輩相談 / 記事 / マイページ（アイコン+ラベル）
  - `position: fixed; bottom: 0; height: 64px; env(safe-area-inset-bottom)` padding
  - `md:hidden` + `globals.css` の `.mobile-bottom-nav-root` で desktop非表示（二重制御）
  - biz/admin/auth/onboarding/profile では非表示
  - `(jobseeker)/layout.tsx` の `<JobseekerFooter />` 後に追加

  **④ ナビ「フィード」削除（`JobseekerHeader.tsx`）:**
  - `NAV_LINKS` から `{ href: "/feed", label: "フィード" }` を削除

  **⑤ InfraSection 簡素化（`page.tsx`）:**
  - 旧: 重厚な `InfraBlock` + `InfraSection`（~250行）
  - 新: 3カードシンプルレイアウト（取材情報 / 第三者相談 / 現役社員OBOG）
  - `grid-cols-1 md:grid-cols-3` Tailwind グリッド、色は royal/warm/success でブランドカラー統一

  **⑥ 企業バッジをより目立つスタイルに（`page.tsx`）:**
  - 「✍ OPINIO取材済み」: `warm-soft` 背景 + `#92400E` テキスト + `#FDE68A` ボーダー
  - 「X名登録中」: `royal-50` 背景 + `var(--royal)` テキスト + `var(--royal-100)` ボーダー
  - 両方とも `fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 100` のピルスタイル

  **バグ修正:**
  - `/api/admin/invite`: biz ユーザー招待の redirect を `/biz/auth/callback`（存在しない）→ `/auth/callback?biz=1` に修正
  - `api/stats/route.ts`: catch フォールバック値を実データに合わせて修正
  - welcome email の企業数テキスト修正

### 🟢 次の優先候補（2026-06-02 セッション11後 更新）
- **ow_articles に company_id を設定** — Admin記事管理画面（`/admin/articles`）でカンパニー紐づけを設定すると「OPINIO取材済み」バッジが自動表示
- **実ユーザー招待・オンボーディング** — DB・機能・UI 全て準備完了
- **企業担当者による求人登録** — `/biz/jobs` から直接登録（テスト求人は削除済み）

### ✅ 完了 2026-06-02 セッション10後半: テストデータ完全削除・OGP自動取得・Admin記事ユーザー紐づけ

  **テストデータ完全削除（Migration 133・134）:**
  - Migration 133: テスト企業31社・求人・テスト担当者30名・テストユーザー10名・現役社員サンプル120名を削除
  - Migration 134: test-mentor-01〜10@opinio.local の ow_users レコード10件を削除（auth_idなしのため auth.users 削除は不要）
  - 現在のDB状態: 企業13社・求人0件・メンター13名・ユーザー96名

  **発信コンテンツ OGP 自動取得（`/api/jobseeker/content-links/ogp/route.ts`）:**
  - `GET /api/jobseeker/content-links/ogp?url=...` 新規APIルート作成
  - サーバーサイドで外部URLをfetch（タイムアウト8秒）、og:title/og:image/og:description を regex で抽出
  - twitter:title/twitter:image もフォールバックとして対応
  - 最初の50KBのみ読み込んで高速化
  - ProfileEditClient の URL 入力欄に `onBlur` を追加 → OGP取得 → タイトル・説明を自動補完
  - `newLinkThumbnail` state を追加、POST時に `thumbnail_url` として送信
  - 「ページ情報を取得中...」スピナー、「✓ タイトル・サムネイルを自動取得しました」サクセス表示

  **Admin 記事画面: ユーザー紐づけ UI（`/admin/articles/page.tsx`）:**
  - `ow_articles.user_id` カラムの設定をAdmin画面から直接操作可能に
  - `ow_users` 一覧をロードし、各記事行に select ドロップダウンを追加
  - 変更即時保存（onChange で supabase.update）、フラッシュトースト通知
  - ヘッダーに「ユーザー紐づけ N/10件」バッジを追加
  - 紐づけ済み行は royal blue のスタイルで視覚的に区別

### 🟢 次の優先候補（2026-06-02 後半更新）

### ✅ 完了 2026-06-02 セッション10: メンター会社名リンク化・メンター実データ移行・写真表示対応

  **メンター詳細ページ: 会社名 → リンク化（`/mentors/[id]/page.tsx`）:**
  - `career_chain` の会社名テキストを `ow_companies.name` で一括照合 → UUID を解決
  - 現職会社名ヘッダーと career breadcrumb の両方を `<Link href="/companies/{id}">` でラップ
  - `company-name-link` CSS クラスでホバーアンダーライン（Session 8 の MergedTimeline 修正と同パターン）
  - TypeScript エラー `Set<string>` spread → `Array.from(names)` に修正

  **メンター実データ移行（`supabase/migrations/132_mentor_real_data.sql`）:**
  - `ow_mentors` に `photo_url TEXT` カラム追加（`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`）
  - 既存テスト10名削除（予約・ブックマーク → メンターの順にカスケード削除）
  - CSVから実メンター13名をINSERT（柴久人・木村勇人・松本圭史・木村雅樹・生藤弘樹・山本博之・小島良介・山崎華奈・藤岡正樹・岡田達哉・木村拓哉・金澤啓太郎・片山幹大）
  - 各メンターの color, roles, question_tags, bio, catchphrase, concerns を CSV から充実
  - ⚠️ **柴さんが手動適用必要**: `supabase db push` or Supabase ダッシュボードで実行

  **写真アップロードスクリプト（`scripts/upload-mentor-photos.mjs`）:**
  - Node.js 18+ ネイティブ fetch で Airtable 一時URLから画像をダウンロード
  - `ow-uploads` バケット `mentors/photos/{slug}.{ext}` にアップロード
  - `ow_mentors.photo_url` を公開URLで更新
  - 山本博之は写真なしでスキップ（12枚対応）
  - ⚠️ **柴さんがMigration適用後に実行**: `node scripts/upload-mentor-photos.mjs`
  - ⚠️ Airtable URL は有効期限あり（期限切れなら再取得が必要）

  **フロントエンド: 写真表示対応（3ファイル）:**
  - `src/lib/supabase/queries.ts`: `MENTOR_COLS` に `"photo_url"` 追加、`MentorData` 型に `photo_url: string | null` 追加、`mapMentor()` でフィールドマッピング追加
  - `src/app/(jobseeker)/mentors/page.tsx`: `MentorCard` の avatar 部分を `photo_url` 優先表示に変更（fallback: gradient + initial）
  - `src/app/(jobseeker)/mentors/[id]/page.tsx`: `Avatar` コンポーネントを `photo_url` 優先の `<img>` + fallback gradient に変更

### ✅ 完了 2026-06-02 セッション10後半（後続）: ホームページ UX 全面改善

  **Hero CTA 再設計:**
  - 旧: 「無料登録する」（主白ボタン）+ 「先輩に相談する」（橙ボタン）+ 小さなリンク
  - 新: 「まず企業を見てみる →」（主白ボタン）+ 「先輩に相談する」（半透明ガラスボタン）+ 「無料で会員登録する」（小リンク）
  - 登録ハードルを下げ、まず見ることを促す設計に変更

  **HowItWorks セクションをヒーロー直下に移動:**
  - 旧順序: Hero → LogoStrip → DiffStrip → Companies → Stats → Infra → HowItWorks
  - 新順序: Hero → **HowItWorks** → LogoStrip → DiffStrip → Companies → Stats → Infra
  - ファーストビュー後すぐに「3ステップで使い方がわかる」設計に

  **HowItWorks コンテンツ刷新:**
  - STEP 01: 「探す」→「登録なしで見る」（登録不要を明示）
  - STEP 02: 「相談する」→「先輩に相談する」（30分・無料を明記）
  - STEP 03: 「決める」→「自分で決める」（ユーザーが主役を強調）
  - 各ステップの action テキストをクリック可能な Link に変更（href 付き）
  - STEP 02 アイコン色を warm orange に変更（相談のイメージを統一）

  **メンターカード: 写真表示対応（ホームページ）:**
  - `PreviewMentor` 型に `photoUrl: string | null` を追加
  - `/api/mentors/preview` に `photo_url` を追加
  - MentorCard: photo_url がある場合は 52px 円形写真、なければ gradient+initial フォールバック

  **企業カード: バッジインフラ整備:**
  - `PreviewCompany` 型に `articleCount?: number`, `memberCount?: number` を追加
  - `/api/companies/preview` に article_count（ow_articles.company_id 集計）と member_count（ow_experiences.company_id 集計）を追加
  - CompanyMiniCard: articleCount > 0 で「✍ OPINIO取材済み」バッジ表示
  - CompanyMiniCard: memberCount > 0 で「X名登録中」バッジ表示（なければ「社員・OBに聞ける」）
  - 記事の company_id 紐づけが進むと自動で表示される

  **求人カード: 給与を成功グリーンで大きく表示:**
  - 旧: `font-size: 11px, color: var(--ink-soft)`
  - 新: `font-size: 13px, font-weight: 700, color: var(--success), font-family: Inter`

### 🟢 次の優先候補（2026-06-02 後半更新）
- ~~Migration 132 の手動適用~~ ✅ 完了済み（MCP経由で適用）
- ~~写真アップロードスクリプトの実行~~ ✅ 完了済み（13名分アップロード完了）
- ~~Admin UI: ow_articles.user_id 設定~~ ✅ 完了済み（2026-06-02 セッション10後半）
- ~~発信コンテンツ OGP サムネイル取得~~ ✅ 完了済み（2026-06-02 セッション10後半）
- ~~ホームページ UX 改善（Phase A + B）~~ ✅ 完了済み（2026-06-02 セッション10後半）
- ~~求人カード改善（勤務地・リモート専用行）~~ ✅ 完了済み（2026-06-02 セッション10後半）
- ~~UserTestimonials 架空の声 → 「こんな人が使っています」シナリオカードに転換~~ ✅ 完了済み（2026-06-02 セッション10後半）
- **ow_articles に company_id を設定** — Admin記事管理画面でカンパニー紐づけを設定すると「OPINIO取材済み」バッジが自動表示
- **実ユーザー招待・オンボーディング** — DB・機能・UI 全て準備完了
- **企業担当者による求人登録** — `/biz/jobs` から直接登録（テスト求人は削除済み）
- **モバイルボトムナビ（Phase C）** — ユーザーが増えてから

### ✅ 完了 2026-05-30 セッション9: 学歴degree拡充・発信コンテンツ機能・/u/[id] UIUX全面刷新

  **学歴 degree ドロップダウン拡充:**
  - 「小学校卒」「中学校卒」を `VALID_DEGREES` に追加（`educations/route.ts` + `educations/[id]/route.ts`）
  - ProfileEditClient の degree 選択肢を `<optgroup>` 形式に変更（初等・中等教育 / 高等教育 グループ）
  - Faculty（学部）はすべての degree で表示（高校以下も含む）

  **発信コンテンツ機能（ow_user_content_links）:**
  - Migration 126: `ow_user_content_links` テーブル作成（url / platform / title / description / thumbnail_url / sort_order / RLS）
  - Migration 126: `ow_articles.user_id UUID` カラム追加（OPINIO掲載記事の紐づけ用）
  - API: `GET/POST /api/jobseeker/content-links` + `PUT/DELETE /api/jobseeker/content-links/[id]`
  - ProfileEditClient: 「発信コンテンツ」タブ追加（URL入力 → platform自動判定 → YouTube/note/Zenn/SpeakerDeck/Podcast/GitHub/other）
  - `/u/[id]`: 「OPINIO掲載記事」セクション（ow_articles.user_id でフィルタ）+ 「発信コンテンツ」セクション

  **`/u/[id]` プロフィールページ UIUX 全面刷新（LinkedIn/Wantedly/YOUTRUST 参照）:**
  - 名前フォントサイズ 26→30px、ヘッダーにスキルチップ TOP5 表示、SNSリンクをヘッダーへ移動
  - Stats 行をピルスタイル（背景付き）に変更
  - 「目指していること」を目立つ standalone カード（purple グラデーション）に変更
  - 「スキル・専門性」セクションをメインカラムに追加（サイドバーから移動）
  - 経歴タイムライン: パスノードにパルスリングアニメーション、在籍年数表示
  - サイドバー在籍企業カード: 在籍年数 + フェーズバッジ表示
  - ❝ 引用記号: U+275D（環境依存）→ SVG path（クロスブラウザ確実）に変更
  - モバイル CSS 追加（`profile-cover` / `profile-avatar` / `profile-name` 等のクラスでレスポンシブ）
  - プロフィール完成度ガイド: オーナー本人のみ表示（黄色バナー + % プログレスバー + 未完了項目チップ）
  - サイドバー求人リンク: 在籍企業の公開求人を最大3件表示 + 「すべての求人を見る →」

  **管理者向け（将来の改善候補）:**
  - `ow_articles.user_id` カラム追加済みだが、既存記事への user_id 設定 UI は未実装
  - 現状は SQL 直接実行で紐づけ可能（`UPDATE ow_articles SET user_id = ... WHERE slug = ...`）

### 🟢 次の優先候補
- **Admin UI: ow_articles.user_id 設定** — 記事詳細管理画面に「紐づけユーザー」選択フィールドを追加
- **発信コンテンツ OGP サムネイル取得** — URL 追加時に OGP メタ取得 → thumbnail_url / title を自動補完
- **実ユーザー招待・オンボーディング** — DB・機能・UI 全て準備完了
- ~~学歴 degree 小中高追加~~ ✅ 完了済み（2026-05-30 セッション9）
- ~~発信コンテンツ URL 紐づけ~~ ✅ 完了済み（2026-05-30 セッション9）
- ~~/u/[id] UIUX 刷新（LinkedIn/Wantedly/YOUTRUST 参照）~~ ✅ 完了済み（2026-05-30 セッション9）

### ✅ 完了 2026-05-23 セッション8: /u/[id] サイドバー化・会社名リンク・loading skeleton 更新

  **`/u/[id]` プロフィールページ全面刷新:**
  - レイアウト: `maxWidth: 760` 1カラム → 2カラムグリッド（`1fr 280px`、最大幅 1060px）
  - メインカラム: カバー+アバターヘッダー（全幅）、About Me、経歴タイムライン
  - サイドバー（`position: sticky`）: 現在の在籍企業カード、メンターCTA、スキルチップ、資格リスト、SNSリンク、非認証CTA
  - レスポンシブ: 900px 以下で1カラムに折りたたみ
  - 「プロフィールを編集」ボタンをヘッダー右に追加（viewerIsOwner=true のみ）

  **MergedTimeline: 会社名 → リンク化:**
  - `company_id` がある場合、会社名を `<Link href="/companies/{id}">` でラップ
  - ホバーでアンダーライン表示（`company-name-link` CSS クラス）
  - 単独 career・並行カード・同社グループヘッダーの3箇所すべてに適用
  - テキスト入力の企業（`company_text` のみ）はクリック不可のまま

  **`biz/members` + `biz/meetings`: `window.confirm` 解消:**
  - `MembersClient.tsx`: 招待キャンセルの確認を inline confirmation row に変更
  - `MeetingDetailPanel.tsx`: 確認ダイアログを inline confirmation UI に変更

  **`/u/[id]` loading skeleton 更新:**
  - 旧 `maxWidth: 720` 1カラム版 → 新 `maxWidth: 1060` 2カラムグリッド版に更新
  - カバー・アバター・メインカラム（About Me + Timeline 3行）・サイドバー（会社カード・スキル・SNS）

  **「在籍メンバー」機能について:**
  - `CurrentEmployeesSection`（現役社員）と `AlumniSection`（OB・OG社員）として既に完全実装済みと確認
  - `/companies/[id]` で `ow_experiences.company_id` を元に自動表示
  - 各カードが `/u/{userId}` にリンク、メンターは「相談する →」ボタン付き
  - 実ユーザー招待 → オンボーディングで会社をマスタ選択した時点で自動表示される

### ✅ 完了 2026-05-23 セッション7: Header/Footer 統一・エラー境界・loading skeleton 網羅・ブランディング完成

  **Header/Footer 統一（11ファイル）:**
  - `career-consultation/`, `career-consultation/[id]/`, `consultation-cases/`, `not-job-changing/`, `companies/list/`, `companies/[id]/jobs/`, `companies/[id]/articles/[articleId]/`, `companies/[id]/members/[memberId]/`, `users/[id]/`, `profile/setup/`, `consultation-request/`
  - 旧 `Header`/`Footer` → `JobseekerHeader`/`JobseekerFooter` に統一

  **エラー境界追加:**
  - `(jobseeker)/error.tsx` — 求職者ルートグループ用（design-system CSS変数使用）
  - `biz/error.tsx` — ビズルートグループ用（ダッシュボードへ戻るリンク付き）
  - `admin/error.tsx` — 管理者ルートグループ用（ADMIN バッジ付き）

  **loading skeleton 網羅（新規作成 25ファイル）:**
  - 求職者詳細ページ: `companies/[id]/loading.tsx`, `jobs/[id]/loading.tsx`, `mentors/[id]/loading.tsx`, `articles/[slug]/loading.tsx`, `u/[id]/loading.tsx`
  - 求職者サブ: `(jobseeker)/about/loading.tsx`, `about/scope/loading.tsx`, `about/selection-criteria/loading.tsx`, `industries/loading.tsx`, `mypage/conversations/loading.tsx`, `mypage/applications/loading.tsx`
  - biz: `biz/dashboard/loading.tsx`, `biz/jobs/loading.tsx`, `biz/meetings/loading.tsx`, `biz/applications/loading.tsx`, `biz/candidates/loading.tsx`, `biz/conversations/loading.tsx`, `biz/analytics/loading.tsx`, `biz/company/loading.tsx`, `biz/members/loading.tsx`, `biz/posts/loading.tsx`
  - admin: `admin/loading.tsx`

  **not-found 追加:**
  - `(jobseeker)/not-found.tsx` — 求職者ルート内 404（レイアウト継承、企業/求人/メンターへの Quick Links）
  - `biz/not-found.tsx` — biz ルート内 404（ダッシュボードへリンク）

  **SEO 改善:**
  - `sitemap.ts` に `/not-job-changing`, `/industries`, `/mentor`, `/business` を追加
  - `career-consultation/`, `consultation-cases/`, `mentor/`, `industries/` に openGraph + alternates: canonical 追加

  **ブランディング完成（セッション7で残り解消）:**
  - `lib/notify/templates.ts`: メール招待テンプレート内 "Opinio Work" → "OPINIO"
  - `layout.tsx` JSON-LD: `name: "Opinio"` → `name: "OPINIO"`
  - `business/page.tsx`, `consultation-request/page.tsx`, API エラーメッセージ, business コンポーネント群
  - `lib/companyPerspective.ts`: source ラベル "Opinio取材ベース" → "OPINIO取材ベース"
  - 残存するのはコードコメントのみ（ユーザー非表示）

### ✅ 完了 2026-05-23 セッション6: 全ページブランディング統一・About ページ改善・フィルター改善

  **About ページ改善:**
  - `/about/scope` + `/about/selection-criteria` を `(jobseeker)` route group に移動（`JobseekerHeader` を継承）
  - 旧 `app/about/scope/` + `app/about/selection-criteria/` ディレクトリを削除（ルート競合解消）
  - `/about` ページにスコープ・審査基準サブページへのナビゲーションカードを追加（「準備中」バナーを置き換え）
  - フッターに `掲載企業の審査基準` リンクを独立して追加

  **DB クエリ修正:**
  - `lib/search/companies.ts`: ow_jobs フィルター `.eq("status", "active")` → `.in("status", ["published", "active"])`

  **フィルター改善:**
  - `/biz/candidates`: `desired_phase` フィルターを `<select>` → ピルボタン（全フェーズ / シリーズA/B/C/上場）に変更

  **SEO 改善:**
  - `sitemap.ts` に `/about`, `/about/scope`, `/about/selection-criteria`, `/consultation-cases` を追加

  **ブランディング統一（"Opinio" → "OPINIO"）:**
  - ページタイトルメタデータ: `root layout`, `not-found`, `career-consultation`, `not-job-changing`, `consultation-cases`, `mentors`, `mentor`, `privacy`, `terms`, `mentor-terms`, `business`, `biz/auth`（全て `| opinio.jp` → `| OPINIO`、`Opinio Work` → `OPINIO`）
  - 本文テキスト（30+ ファイル）: FaqSection, HomeFaq, home page, company detail, companies client, CasualMeetingForm, ReserveForm, biz/auth, biz/company edit, biz/jobs, biz/candidates, admin pages, etc.
  - 残存する legal entity 名 `Opinio Inc.` / `Opinio, Inc.` はそのまま（法人名）

### ✅ 完了 2026-05-23 セッション5: 全ページ DB クエリ監査・壊れたリンク修正

  **DB クエリ修正（5件）:**
  - `consultation-cases/page.tsx`: PostgREST join を `mentors(...)` → `ow_mentors(...)` に修正（FK は ow_mentors を参照）
  - `consultation-cases/ConsultationCasesClient.tsx`: 型定義 `mentors` → `ow_mentors`、参照も同期
  - `companies/[id]/jobs/page.tsx`: `status === "active"` → `status === "published"`（Migration 113 後の正規値）
  - `Header.tsx`: 新着求人カウント `.eq("status", "active")` → `.in("status", ["published", "active"])`
  - `genres.ts`: 企業別求人数カウント `.eq("status", "active")` → `.in("status", ["published", "active"])`

  **調査・確認済み（問題なし）:**
  - `consultation-cases` テーブル ✅、`ow_mentor_reservations` テーブル ✅ 存在確認
  - `company_articles` テーブルは存在しない（`companies/[id]/articles/[articleId]` は孤立ページ・リンクなし）
  - `ow_applications` と `ow_job_applications` 両方存在、コードは正しく後者を使用
  - `(jobseeker)/about/page.tsx` が `/about` を担当（route group）→ footer リンク正常
  - ビジネスナビ全リンク（11件）正常確認
  - フッターリンク全件正常確認
  - `ow_company_external_links`、`ow_user_skill_tags`、`ow_user_educations`、`ow_user_certifications` など全テーブル存在確認
  - `profile/setup/page.tsx` は孤立ページ（`ow_user_profiles` 旧テーブル使用・リンクなし）→ 放置

  **前セッション（コンテキスト圧縮前）の修正:**
  - `biz/posts/PostsClient.tsx`: `var(--gold)` → `var(--warm)`（未定義CSS変数修正）
  - `biz/candidates/page.tsx`: ow_profiles フェッチを `createClient` → `createAdminClient`（RLS バイパス修正）
  - `api/cron/weekly-jobs` + `weekly-match`: フッター URL `/dashboard` → `/mypage`、ブランド `opinio.work` → `OPINIO`
  - `career-consultation/page.tsx`: ow_profiles の非存在カラム（consultation_tags / current_company_type）をSELECTから削除
  - `career-consultation/CareerConsultationClient.tsx`: 上記2カラムを optional 型に
  - `career-consultation/[id]/page.tsx`: 「相談を申し込む」→ `/consultation-request`（存在しないページ）から `/mentors/{id}/reserve` に修正
  - `components/business/EditorInvitation.tsx`: `申し込む` → `/biz/editor-request`（存在しないページ）から `mailto:` リンクに修正
  - `components/business/TeamMembers.tsx`: `管理 →` → `/biz/team` → `/biz/members` に修正
  - `components/business/RecruiterProfile.tsx`: `編集 →` → `/biz/profile` → `/biz/company` に修正
  - `companies/[id]/members/[memberId]/page.tsx`: `/mypage/profile` (8箇所) → `/profile/edit` に修正

### ✅ 完了 2026-05-23 セッション4: UX 改善・候補者プロフィールリンク展開・応募数表示

  **ブックマーク初期状態:**
  - `JobsClient.tsx`: `useEffect` でマウント時に `GET /api/bookmarks?target_type=job` → `bookmarkedIds: Set<string>` state
  - `JobCard` に `initialBookmarked?: boolean` prop + `useEffect` 同期 → 非同期ロード後もハートが正しく表示

  **求人管理（/biz/jobs）応募数表示:**
  - `BizJob` 型に `applicationCount: number` フィールドを追加
  - `fetchJobsForCompany` で `ow_job_applications` job_id 別カウントを meeting と並行取得
  - `JobListCard` 下段メタに「N 件の応募」バッジ（success グリーン、公開求人のみ）

  **候補者プロフィールリンク全面展開:**
  - `BizApplicationsClient`: 詳細パネルに「公開プロフィール」リンクボタン追加
  - `MeetingDetailPanel`: 「詳細プロフィール →」が `/u/{applicantUserId}` に実際リンク
  - `MeetingApplication` 型に `applicantUserId: string | null` フィールド追加
  - `DashboardMeeting` 型に `candidateUserId: string | null` フィールド追加
  - `PendingMeetings`: 候補者名から `/u/{candidateUserId}` へリンク
  - `/biz/conversations/[id]`: 「プロフィール詳細（準備中）」→ 実際の `/u/{id}` リンクに変更

  **プレースホルダーアラート解消:**
  - `CompanyEditClient`: プレビュー → `window.open /companies/{companyId}`
  - `JobEditForm`: プレビュー → `window.open /jobs/{jobId}` (jobId なければ disabled)
  - `MeetingsClient`: 返信 → `/biz/conversations` へ router.push

  **候補者サーチ:** `/biz/candidates` フェッチ上限 100 → 500（全 266 ユーザーを表示）

### ✅ 完了 2026-05-23 セッション3: ビルドエラー修正・プロフィール完成度強化・マイページ改善
  - **ビルドエラー修正**:
    - `Footer.tsx`・`MeetingCard.tsx`・`MeetingDetailPanel.tsx`・`MeetingStatusTabs.tsx`・`MeetingSearchBar.tsx` に `"use client"` 追加
    - イベントハンドラーをサーバーコンポーネントから渡す RSC エラーを解消 → `/about/scope` タイムアウト解消
  - **`/profile/edit` 希望条件タブ強化**:
    - `今一番の悩み`（worry）select を追加（オンボーディング回答を後から変更可能に）
    - `興味のある企業フェーズ`（desired_phase）multi-select を追加（シリーズA/B/C/上場 → ow_companies.phase と一致）
    - `prefPhase` state 追加、ARRAY として career-preferences API に保存
  - **`/mypage` プロフィール完成度ウィジェット**:
    - `希望条件` を 7 番目のチェック項目として追加
    - `mypage/page.tsx` で ow_profiles を fetch し `hasCareerPreferences` を算出
    - `MypageClient` → `DashboardView` → `ProfileCompletenessCard` にプロップとして渡す
  - **`/mypage` isMentor 修正**:
    - `const { isMentor } = useMypageMock()` （常に false）→
      `const isMentor = (owUser?.is_mentor === true) || isMentorMock`
    - 実際に `is_mentor=true` のユーザーがメンター UI を見られるように
  - **`/biz/candidates` job_type フィルター修正**:
    - `JOB_TYPE_LABELS` の英語スラッグキー（product_manager等）→ 日本語文字列に修正
    - `ow_profiles.job_type` はオンボーディングで保存された日本語文字列のため

### ✅ 完了 2026-05-23 セッション2: 求職者サーチ＋公開プロフィール連携強化
  - `/biz/candidates/page.tsx` クエリ修正:
    - `work_style_preference` → `desired_work_style`（正しいカラム名）
    - `current_role`/`current_company` を `ow_profiles` から削除 → `ow_experiences`（is_current=true）から別取得
    - `ow_users.visibility = 'public'` フィルタは正常動作確認（全ユーザー public がデフォルト）
  - `CandidatesClient.tsx` リニューアル:
    - 職種フィルター（job_type）追加、work style フィルター修正
    - 各カードに `/u/{id}` 公開プロフィールリンク（新しいタブで開く）
    - アバターグラデーションをユーザーIDハッシュで多色化
    - CSS変数（`var(--royal)`等）を使用してデザイン統一
  - `UserProfileCard.tsx` に「公開ページ →」リンクボタン追加（編集ボタン左隣）
  - `ProfileEditClient.tsx` の可視性設定セクションに「公開プロフィールを見る」リンク追加
  - `admin/candidates/page.tsx` の名前セルを `/u/{id}` リンク化
  - `jobs/JobsClient.tsx` のブックマーク TODO を実装:
    - `/api/bookmarks` POST/DELETE 呼び出し（楽観的更新 + エラー時リバート）
    - 401 返却時は `/auth?next=...` へリダイレクト
    - 連打防止のため `bookmarkingRef` を使用



### ✅ 完了 2026-05-22 セッション3: Supabase 接続完成度チェック＋在籍企業チェック実装
  - `/mypage` が完全 Supabase 接続済みであることを確認（casual_meetings / mentor_reservations / bookmarks / timeline 全件）
  - `casual-meeting/page.tsx` に `ow_experiences` ベースの在籍企業チェックを実装
    - `is_current=true AND company_id=params.id` の experience があればブロック画面表示
    - warm orange アイコン + 「現在ご在籍中の企業です」メッセージ + 「他の企業を探す」ボタン
  - `ow_articles` テーブルが既存（10件）であることを発見 → articles ページは既に Supabase 接続済みを確認
  - `ow_bookmarks` RLS・ユニーク制約・API 全て正常動作確認
  - ow_mentors 全件 user_id 設定済み → 受信リクエスト表示も正常

### ✅ 完了 2026-05-22 セッション2: Phase 6 デザイン統一
  - `var(--gold)` → `var(--warm)`、`var(--royal-deep)` → `#001233`（未定義CSS変数修正）
  - カジュアル面談CTA: white/royal → warm orange グラデーション（companies/[id]・jobs/[id]）
  - `FloatingCTA` に `variant="royal"|"warm"` prop 追加
  - フィルターUI: `<select>` → ピルボタン（companies: workStyle + size / jobs: work_style）
  - CompanySearchBar: 募集中トグルをピル風に、アクティブサマリーバッジ追加

### ✅ 完了 2026-05-22 セッション2: QB-6 CategoriesEditor エッジケース（7項目）
  - 保存成功後ちらつき修正（isSavedDisplayingRef で router.refresh 競合防止）
  - AddCategoryModal: 全件追加済み空状態 / ロール0件空状態
  - 保存中のボタン無効化（isSaving ガード）
  - エラー時は未保存バナーを非表示（error バナーのみ + リトライ案内）
  - 両モーダルに Escape キー対応（useModalClose フック）
  - beforeunload 警告（isDirty かつ非保存時のページ離脱）

### ✅ 完了 2026-05-22 セッション2: Cron バグ修正 + Resend 有効化
  - weekly-jobs + weekly-match: `.eq("status", "active")` → `"published"`（Migration 113 対応）
  - weekly-match: Resend 送信を有効化（TODO 解消）+ notify_email フィルター追加
  - weekly-jobs: `from` アドレスを RESEND_FROM_EMAIL env var に統一

### ✅ 完了 2026-05-22 セッション2: /biz/analytics 実装確認
  - 実装済みであることを確認（KPI・ファネル・バーチャート・求人パフォーマンステーブル）
  - DB データは現在すべて 0（ow_business_monthly_stats 0件、ow_casual_meetings 0件）→ 正常

### ✅ 完了 2026-05-22: Migration 113 — ow_jobs.status 正規化
### ✅ 完了: Phase ε — Supabase MCP 接続 read-only（2026-05-02）
### ✅ 完了: photos + logo の Supabase Storage 接続（2026-04-27）
### ✅ 完了: dashboard placeholder 解消（2026-04-27）
### ✅ 完了: Phase 5 Stage 2 — 認証フロー（実装済み確認 2026-05-22）
### ✅ 完了: /biz/members・/biz/meetings・/biz/jobs・admin/jobs/[id]（実装済み確認 2026-05-22）
### ✅ 完了 2026-05-22: biz/auth MOCK_EXISTING_USERS バグ修正
### ✅ 完了 2026-05-22: 外部サービス接続・env var 整備（Resend / CRON_SECRET / SITE_URL）

### ✅ 完了（セッション3 調査発見・既実装）: 求人応募フロー＋メッセージ機能
  - `/jobs/[id]/apply` + `ApplicationForm.tsx` — フォーム実装済み
  - `/api/applications/route.ts` — POST: ow_applications 書込・Resend・insertActivity
  - `/mypage/applications/page.tsx` — 応募一覧（Supabase接続・319行）
  - `/mypage/conversations/page.tsx` — 会話一覧（Supabase接続）
  - `/mypage/conversations/[id]/page.tsx` — リアルタイムメッセージ（Supabase接続・419行）
  - `/biz/applications/` — 企業側応募管理
  - `/biz/conversations/` + `/biz/conversations/[id]/` — 企業側メッセージ管理

### ✅ 完了 2026-05-22 セッション3: biz 側機能完成度向上
  - BusinessLayout に `/biz/conversations`（対話管理）をナビ追加（Inbox アイコン）
  - `BizApplication` 型に `userId` + `conversationId` フィールド追加
  - `biz/applications/page.tsx`: ow_conversations を照合して conversationId を付与
  - `ApplicationsClient`: `conversationId` がある場合に「対話を見る →」ボタン表示
  - ActivityList 全 9 イベント既実装を確認:
    casual_meeting_applied / application_received / message_sent / message_received /
    candidate_status_changed / offer_sent / meeting_scheduled / meeting_completed / job_published

### ✅ 完了 2026-05-23: UIUX 全面刷新（30ファイル +1277行）
  求職者向け:
  - ホームページ: Hero に機能する検索バー＋クイックタグ追加、Stats を実データ（36社/30件）に更新
  - グローバルヘッダー: 🔍 アイコンクリックで全幅検索オーバーレイ（Escape 閉じ対応）
  - 企業一覧: 面談受付中バッジにパルスアニメーション、受付中企業カードに緑ボーダー
  - 求人一覧: 🏠/🏢 勤務形態アイコン、📍場所タグ、給与を success グリーンで強調表示
  - 求人詳細: NEW バッジ（7日以内）、給与大きく表示、モバイル sticky CTA バー
  - メンター: 受付中パルスドット、相談件数バッジ、warm orange CTA
  - マイページ: プロフィール完成度ウィジェット（ダッシュボード最上部）、空状態 icon+CTA 化
  - プロフィール編集: グローバル保存状態インジケーター（✓ 保存済み）、タブ補完ドット
  - 記事: 読了時間日本語表記、バッジ色 type 別統一
  企業向け (/biz):
  - 選考管理バッジ 5色統一、求人管理空状態 3ステップガイドに刷新
  - 面談タブ ステータス別カラー、面談/Activity/JobStatus 空状態 CTA 改善
  管理者 (/admin): 赤い ADMIN バッジ、KPI 4枚化（累計応募数追加）
  グローバル CSS: pulseDot / fadeInUp / card-hover / skeleton-shimmer 追加

### ✅ 完了 2026-05-23: mentor-reservations → insertActivity 追加
  - `/api/mentor-reservations/route.ts`: INSERT 成功後に best-effort で insertActivity
  - ow_mentors.user_id → ow_user_roles.tenant_id を辿り、メンターの所属企業の biz ダッシュボードへ流す
  - type: "mentor_reservation_received"、description: "{メンター名} へのメンター相談リクエストが届きました"
  - activities.ts TYPE_MAP に mentor_reservation_received → "meeting_scheduled" を追加
  - admin/page.tsx の ow_applications → ow_job_applications テーブル名バグ修正

### 🟢 次の優先候補
- **実ユーザー招待・オンボーディング** — DB・機能・UI 全て準備完了。企業担当者＋求職者を招待してテスト可能
- **ow_profiles への実データ投入確認** — 実ユーザーを招待し、オンボーディング → profile/edit 希望条件 → /biz/candidates に表示される E2E フローを確認
- ~~SEO / OGP 強化~~ ✅ 完了済み（企業詳細・求人詳細・メンター・記事 全ページに generateMetadata + og:image）
- ~~新機能検討~~ ✅ `/u/[id]` 公開プロフィール・`/biz/candidates` 両方実装済み
- ~~求職者プロフィール完成度~~ ✅ 完了済み（希望条件タブ・7項目完成度チェック 2026-05-23 セッション3）
- ~~ow_users.visibility の UI 動作確認~~ ✅ RLS 確認済み（public/login_only/private それぞれ正しく動作）
- ~~biz側 desired_phase フィルター~~ ✅ 完了済み（ピルボタン UI に変更済み 2026-05-23 セッション6）
- ~~/u/[id] サイドバー化~~ ✅ 完了済み（2カラムグリッド、在籍企業カード・スキル・SNS を sidebar に移動 2026-05-23 セッション8）
- ~~会社名→企業詳細リンク（MergedTimeline）~~ ✅ 完了済み（company_id がある場合のみリンク化 2026-05-23 セッション8）
- ~~「在籍メンバー」機能~~ ✅ 既実装確認済み（CurrentEmployeesSection / AlumniSection として /companies/[id] に存在）

### DB 現状（2026-05-22 セッション3 更新確認）
| テーブル | 件数 | 備考 |
|---------|------|------|
| ow_companies | 36件 | 31件公開、全件 accepting_casual_meetings=true |
| ow_jobs | 30件 | 全件 status="published"（Migration 113 適用済み） |
| ow_mentors | 10件 | 全件 is_available=true、全件 user_id 設定済み |
| ow_articles | 10件 | 全件 is_published=true、Supabase 接続済み |
| ow_bookmarks | 1件 | RLS・ユニーク制約・API 正常 |
| ow_conversations | 4件 | 会話データあり |
| ow_applications | 0件 | 求人応募データなし |
| ow_users | 23件+ | ow_profiles 20件 |
| ow_casual_meetings | 0件 | 申込データなし |
| ow_mentor_reservations | 0件 | 予約データなし |

---

## 実装済みページ全一覧（2026-04-24 時点）

### Phase 2 — 求職者側 公開ページ（閲覧）

| ページ | パス | ファイル |
|--------|------|---------|
| トップ | `/` | `src/app/page.tsx` |
| 企業一覧 | `/companies` | `src/app/companies/page.tsx` |
| 企業詳細 | `/companies/[id]` | `src/app/companies/[id]/page.tsx` |
| 求人一覧 | `/jobs` | `src/app/jobs/page.tsx` |
| 求人詳細 | `/jobs/[id]` | `src/app/jobs/[id]/page.tsx` |
| メンター一覧 | `/mentors` | `src/app/mentors/page.tsx` |
| 記事一覧 | `/articles` | `src/app/articles/page.tsx` |
| 記事詳細 | `/articles/[slug]` | `src/app/articles/[slug]/page.tsx` |

### Phase 4 — 求職者側 対話アクションページ（2026-04-24 完成）

| ページ | パス | ファイル |
|--------|------|---------|
| プロフィール編集 | `/profile/edit` | `src/app/profile/edit/page.tsx` |
| マイページ | `/mypage` | `src/app/mypage/page.tsx` |
| カジュアル面談申込 | `/companies/[id]/casual-meeting` | `src/app/companies/[id]/casual-meeting/page.tsx` |
| メンター相談予約 | `/mentors/[id]/reserve` | `src/app/mentors/[id]/reserve/page.tsx` |

---

## Phase 4 実装サマリー（2026-04-24 完成）

### 実装規模

| フェーズ | ページ | 行数 |
|---------|--------|------|
| Phase 4a | `/profile/edit` | +11,368行 |
| Phase 4b | `/mypage` | +12,858行 |
| Phase 4c | `/companies/[id]/casual-meeting` | +13,634行 |
| Phase 4d | `/mentors/[id]/reserve` | +14,409行 |
| **Phase 4 合計** | | **+52,269行** |
| **プロジェクト累計** | | **約88,000行超** |

### Phase 4a: `/profile/edit`
- Notion スタイルサイドバー（基本情報 / キャリア / SNS / アカウント設定）
- 自動保存 700ms デバウンス（idle → saving → saved 3状態 UX）
- 会社名3パターン: master（MOCK_COMPANIES から検索）/ 自由入力 / 匿名表示
- 職種マスター: 2階層ドロップダウン（7カテゴリ × サブロール）
- キャリア CRUD: 追加・編集・削除・現職フラグ
- プロフィール完成度プログレスバー（6項目で計算）

### Phase 4b: `/mypage`
- 6ビュー切替（ダッシュボード / カジュアル面談 / メンター相談 / ブックマーク / 受けた相談 / スケジュール）
- `isMentor` トグル → サイドバーに「メンター管理」セクションを動的表示
- ステータスピル 6状態: pending(amber) / company_contacted(royal) / scheduled(purple) / completed(gray) / declined(error) / approved(success)

### Phase 4c: `/companies/[id]/casual-meeting`
- **在籍企業制約**（Hisato 思想）: `MOCK_PROFILE.experiences[isCurrent=true]` と企業 ID を照合し、在籍中なら申込不可表示
- 求人 ID 引き継ぎ: `?job_id=xxx` で宛先カードに求人情報表示、`× 紐づけを外す` で解除
- **warm orange グラデーション** CTA + 3ステップ成功モーダル

### Phase 4d: `/mentors/[id]/reserve`
- `mentor.themes` から相談テーマを動的生成（メンターごとに異なる）
- 5ステップフロー可視化（申請→編集部確認→メンター承認→日程調整→対話）
- 希望曜日7択 + 時間帯6択（`Set<string>`）
- **royal グラデーション** CTA + 無料バッジ（MVP期間配慮）+ 5ステップ成功モーダル

---

## デザインシステム

### CSS カスタムプロパティ（globals.css）
```css
--royal: #002366; --royal-50: #EFF3FC; --royal-100: #DCE5F7;
--accent: #3B5FD9; --success: #059669; --success-soft: #ECFDF5;
--warm: #F59E0B; --warm-soft: #FEF3C7;
--purple: #7C3AED; --purple-soft: #F3E8FF;
--error: #DC2626; --error-soft: #FEE2E2;
--ink: #0F172A; --ink-soft: #475569; --ink-mute: #94A3B8;
--line: #E2E8F0; --line-soft: #F1F5F9; --bg-tint: #F8FAFC;
```

### フォント・CTA
- フォント: `"Noto Serif JP"` 見出し / `"Noto Sans JP"` 本文 / `Inter` 数字・ラベル
- ステータスピル: pending(amber) / royal(pending_review) / purple(scheduled) / gray(completed) / error(declined) / success(approved)
- CTA 色: warm orange（カジュアル面談）/ royal blue（メンター予約・企業詳細）

---

## Hisato 思想（実装済み）

1. **キャリアを考え続ける人**: 「転職活動中」フラグなし。情報収集中でも使える
2. **Users 統合設計**: `is_mentor` フラグ1つで求職者↔メンター動的発動（マイページで実証済み）
3. **スカウトしない、採用を**: 企業→求職者へのスカウト機能なし。対話から始まる設計
4. **運営の丁寧な介在**: メンター登録は個別声がけ、相談は編集部が精査してから転送
5. **モニター期配慮**: 料金表示なし、無料バッジ（MVP期間中は無料）のみ
6. **在籍企業制約**: 現在在籍中の企業へのカジュアル面談申込を UI でブロック
7. **数値データ撤廃**: マッチ度%・星評価なし。求職者が自分で判断する
8. **position_members**: 各求人に「この職種を経験した人」を表示。snapshot思想
9. **取材時スナップショット**: 記事の `role_at_interview` + `current_status` で時制を両方表示

---

## モックデータ — 田中翔太さん（統一ペルソナ）

Phase 4 全体で使用している架空ユーザー。**変更した場合は全ファイルを整合させること。**

```typescript
// src/app/profile/edit/mockProfileData.ts
name: "田中 翔太"
email: "tanaka@example.com"
avatarColor: "linear-gradient(135deg, #002366, #3B5FD9)"

experiences: [
  {
    id: "exp-1",
    companyType: "master",
    companyId: "layerx",          // ← 在籍企業制約のデモキー
    displayCompanyName: "株式会社LayerX",
    roleCategoryId: "product_manager",
    roleTitle: "プロダクトマネージャー（Bakuraku事業）",
    startedAt: "2024-04",
    isCurrent: true,              // ← /companies/layerx/casual-meeting が blocked
  },
  { displayCompanyName: "株式会社タイミー", isCurrent: false },
  { displayCompanyName: "株式会社リクルート", isCurrent: false },
]
```

> **デモポイント**: `/companies/layerx/casual-meeting` → 「現在ご在籍中の企業です」表示

---

## 主要データモデル（mock）

### `src/app/companies/mockCompanies.ts`
- 12社収録: layerx / smarthr / hubspot / salesforce / ubie / freee / sansan / moneyforward / datadog / kubell / notion / pksha
- `MOCK_COMPANIES` export（`Company` 型）

### `src/app/jobs/mockJobData.ts`
- 15求人収録（12社）、`getJobById()`, `filterJobs()`, `getJobsByCompany()` export
- `PositionMember.is_mentor: true` で `/mentors` と紐づく

### `src/app/mentors/mockMentorData.ts`
- 17名収録、`MOCK_MENTORS`, `filterMentors()` export
- `id` は kebab-case（例: `watanabe-miho`）→ `/mentors/[id]/reserve` の URL

### `src/app/articles/mockArticleData.ts`
- 10記事収録: employee×2 / mentor×4 / ceo×2 / report×2

---

## ════════════════════════════════════════

## Phase 5: Supabase 接続

### ✅ Stage 1 完了（2026-04-24）

**対象ページ**: `/companies`, `/companies/[id]`, `/jobs`, `/jobs/[id]`

**新規ファイル**: `src/lib/supabase/queries.ts`
- `getCompanies()` — ow_companies 一覧
- `getCompanyById(id)` — ow_companies 詳細 + ow_jobs（そのカンパニーの求人）
- `getJobs()` — ow_jobs 一覧 + ow_companies（会社情報）
- `getJobById(id)` — ow_jobs 詳細 + ow_companies（会社情報）

**変更ファイル**:
- `companies/page.tsx` — `MOCK_COMPANIES` → `getCompanies()`（async Server Component）
- `companies/[id]/page.tsx` — `getCompanyDetail` → `getCompanyById()`
- `jobs/page.tsx` — `MOCK_JOBS` → `getJobs()`、`JobCard` に `companies` prop 追加
- `jobs/[id]/page.tsx` — `getJobById`(mock) → `fetchJobById`(Supabase)、`relatedJobs = []`

**継続 mock**: `/mentors`, `/articles`, Phase 4 ページ（profile/edit, mypage, casual-meeting, reserve）は mock のまま

---

## Phase 5 Stage 2 以降（未実装）

### Supabase 現状確認（2026-04-24 確認済み）

#### 環境・パッケージ（すべて準備完了）

| 項目 | 状態 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ 設定済み（.env.local） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ 設定済み |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ 設定済み |
| `@supabase/supabase-js` | ✅ v2.101.1 |
| `@supabase/ssr` | ✅ v0.10.0 |
| `src/lib/supabase/client.ts` | ✅ createBrowserClient 実装済み |
| `src/lib/supabase/server.ts` | ✅ createServerClient + cookies 実装済み |
| `src/lib/supabase/admin.ts` | ✅ service role client 実装済み |
| `src/lib/supabase/middleware.ts` | ✅ 実装済み |

#### テーブル確認結果（2026-04-24 時点）

| テーブル名 | 行数 | ID形式 | 状態 |
|-----------|------|--------|------|
| `ow_companies` | 13行 | UUID | ✅ データあり（全件 `is_published: false`） |
| `ow_jobs` | 25行 | UUID | ✅ データあり（全件 `status: "active"`） |
| `mentors` | 10行 | UUID | ✅ データあり（`ow_mentors` ではなく `mentors`） |
| `ow_users` | 23行 | UUID | ✅ データあり（auth.users連携済み） |
| `ow_roles` | 29行 | UUID | ✅ データあり |
| `ow_articles` | ❌ なし | — | 記事テーブルは存在しない |

#### mock vs Supabase 重要差分

| 差分 | mock データ | Supabase | 対応方針 |
|------|------------|----------|---------|
| **Company ID形式** | スラッグ（`"layerx"`） | UUID | URL を UUID ベースに変更 |
| **テーブル名** | ow_mentors 想定 | `mentors`（ow_ なし） | クエリで `mentors` を使う |
| **company.gradient** | `gradient` フィールド | `logo_gradient` | マッピング層で変換 |
| **company.is_published** | N/A | 全件 false | dev環境ではフィルター無効化 |
| **job_count** | 数値あり | 別途 COUNT 必要 | ow_jobs を JOIN or 0固定 |
| **mentor.initial** | `initial` フィールド | `avatar_initial` | マッピング層で変換 |
| **mentor.gradient** | `gradient` フィールド | `avatar_color` | マッピング層で変換 |
| **mentor.themes** | `themes: string[]` | `question_tags: string[]` | マッピング層で変換 |
| **career_chain** | 構造化配列 | テキスト（`current_career`, `previous_career`） | 簡略化 or パース |
| **position_members** | 構造化配列 | Supabase にない | 空配列でフォールバック |
| **記事** | mock 10件あり | テーブルなし | `/articles` は mock 継続 |

#### ow_companies 主要カラム（95カラム中、Stage 1 で使うもの）
```
id, name, tagline, mission, industry, phase,
employee_count, logo_gradient, logo_letter, logo_url,
location, url, remote_work_status, flex_time, side_job_ok,
accepting_casual_meetings, is_published, updated_at,
fit_positives, fit_negatives, why_join, description,
founded_year, avg_salary, avg_age, female_ratio
```

#### ow_jobs 主要カラム（50カラム中、Stage 1 で使うもの）
```
id, company_id, title, job_category, employment_type,
work_style, location, salary_min, salary_max,
description, requirements, preferred_skills, catch_copy,
one_liner, selection_process, status, published_at, updated_at,
remote_work_status
```

#### mentors 主要カラム（21カラム）
```
id, name, avatar_initial, avatar_color, bio, catchphrase,
current_company, current_role, current_career, previous_career,
roles, question_tags, worries, concerns,
is_available, success_count, total_sessions, display_order
```

---

### Phase 5 段階的実装ロードマップ

| 段階 | 内容 | 認証要否 | 状態 |
|------|------|---------|------|
| **Stage 1** | 読み取り専用ページ（/companies, /jobs） | 不要 | **✅ 完了（2026-04-24）** |
| Stage 2 | 認証フロー（/auth サインアップ → ow_users 自動作成） | 必要 | 未着手 |
| Stage 3 | プロフィール編集（/profile/edit 認証ガード + 自分のデータ） | 必要 | 未着手 |
| Stage 4 | マイページ（/mypage 認証ガード + 関連データ集約） | 必要 | 未着手 |
| Stage 5 | アクションページ（カジュアル面談・メンター予約の永続化） | 必要 | 未着手 |

---

### Stage 1 実装計画（詳細）

#### 作業ファイル一覧

**新規作成:**
```
src/lib/supabase/queries.ts   ← 型付きクエリ関数 + Supabase→mock型マッピング
```

**修正（list pages → Supabase fetch に切り替え）:**
```
src/app/companies/page.tsx    ← getCompanies() 呼び出し
src/app/jobs/page.tsx         ← getJobs() 呼び出し
src/app/mentors/page.tsx      ← getMentors() 呼び出し
```

**修正（detail pages → UUID で Supabase fetch）:**
```
src/app/companies/[id]/page.tsx          ← getCompanyById(uuid)
src/app/jobs/[id]/page.tsx               ← getJobById(uuid) + company JOIN
src/app/mentors/[id]/reserve/page.tsx    ← getMentorById(uuid)
```

**変更なし（mock 継続）:**
```
src/app/articles/page.tsx         ← ow_articles テーブルなし
src/app/articles/[slug]/page.tsx  ← mock 継続
src/app/companies/[id]/casual-meeting/page.tsx  ← Phase 5 Stage 5 で対応
```

#### queries.ts に実装する関数

```typescript
// src/lib/supabase/queries.ts

// ── Companies ──────────────────────────────────────────────────────
getCompanies(filter?: CompanyFilter): Promise<Company[]>
getCompanyById(id: string): Promise<Company | null>

// ── Jobs ───────────────────────────────────────────────────────────
getJobs(filter?: JobFilter): Promise<Job[]>     // ow_jobs JOIN ow_companies
getJobById(id: string): Promise<Job | null>     // company 情報込み

// ── Mentors ────────────────────────────────────────────────────────
getMentors(filter?: MentorFilter): Promise<Mentor[]>
getMentorById(id: string): Promise<Mentor | null>
```

#### カラムマッピング仕様

```
// Company型マッピング
ow_companies.id             → Company.id         (UUID そのまま使用)
ow_companies.name           → Company.name        (株式会社プレフィックス含む)
ow_companies.tagline        → Company.tagline
ow_companies.industry       → Company.industry
ow_companies.phase          → Company.phase
ow_companies.employee_count → Company.employee_count
ow_companies.logo_gradient  → Company.gradient    (null なら royal fallback)
ow_companies.logo_letter    → Company.initial     (null なら name[0])
ow_companies.accepting_casual_meetings → Company.accepting_casual_meetings
ow_companies.updated_at     → Company.updated_days_ago (daysSince 計算)
ow_companies.is_published   → Company.is_dimmed   (!is_published)
// work_styles: remote_work_status + flex_time + side_job_ok から推定

// Mentor型マッピング
mentors.id              → Mentor.id
mentors.avatar_initial  → Mentor.initial
mentors.avatar_color    → Mentor.gradient
mentors.name            → Mentor.name
mentors.current_company → Mentor.current_company
mentors.current_role    → Mentor.current_role
mentors.question_tags   → Mentor.themes
mentors.roles[0]        → Mentor.dept
mentors.is_available    → (フィルター用)
// career_chain: current_career + previous_career テキストから1-2ステップ生成

// Job型マッピング
ow_jobs.id              → Job.id
ow_jobs.company_id      → Job.company_id          (UUID)
ow_jobs.title           → Job.role
ow_jobs.job_category    → Job.dept
ow_jobs.employment_type → Job.employment_type
ow_jobs.location        → Job.location
ow_jobs.work_style      → Job.work_style
ow_jobs.salary_min      → Job.salary_min
ow_jobs.salary_max      → Job.salary_max
ow_jobs.catch_copy      → Job.highlight
ow_jobs.published_at    → Job.is_new (7日以内)
ow_jobs.updated_at      → Job.updated_days_ago
// position_members: [] (Supabase にないため空配列)
```

#### URL変更による影響

- `/companies/layerx` → `/companies/{uuid}` （**URL構造が変わる**）
- `/jobs/smarthr-csm` → `/jobs/{uuid}`
- `/mentors/watanabe-miho` → `/mentors/{uuid}`
- `casual-meeting/reserve` の内部リンクも UUID に更新が必要

> **注意**: Phase 4 で実装した `casual-meeting` ページの在籍企業制約は、
> Phase 5 Stage 5 で `ow_users.experiences` が整備されるまで mock 継続。

---

## Phase ε: Supabase MCP 接続（read-only）— 完了 2026-05-02

### 設定ファイル

- **ファイル**: `/Users/hisato/opinio-work/.mcp.json`（プロジェクトルート、git 管理対象）
- **設定内容**:
  ```json
  {
    "mcpServers": {
      "supabase": {
        "type": "http",
        "url": "https://mcp.supabase.com/mcp?project_ref=xtutnecqeamftygufxco&read_only=true"
      }
    }
  }
  ```
- **認証**: OAuth ベース（dynamic client registration）— PAT / トークン不要
- **初回**: Claude Code 再起動後、Supabase OAuth 認証フローが自動起動する

### MCP 利用ルール（厳守）

| 操作 | 方法 |
|------|------|
| SELECT / テーブル構造確認 / レコード数取得 | ✅ MCP 経由で OK（read_only=true） |
| INSERT / UPDATE / DELETE / DDL | ❌ SQL ファイル作成 → 柴さん手動実行 |
| `read_only=true` の解除 | ❌ 事前に柴さんと議論必須 |

### よく使う確認クエリ例

```
"ow_companies テーブルの構造を見せて"
"ow_users の総レコード数を教えて"
"fit_positives が登録されている企業の数は？"
"ow_jobs で status = 'active' の件数は？"
```

### Phase ε の効果

- セッション冒頭の「テーブル構造調査」「サンプルデータ確認」「カラム名・型確認」が自動化
- 「DB 全社が同じ状態（fit_positives = null）」のような発見が毎セッション楽にできる
- Phase H v2 や次のサンプル投入時に「企業情報の事前調査」が自動化される

---

## 技術的注意事項

### 作業ディレクトリ
- ファイルは `/Users/hisato/opinio-work/src/...` に直接書く（worktree 不要）
- dev サーバーは `/Users/hisato/opinio-work/` で `npm run dev`（launch.json の `dev`）

### Git 運用方針（2026-05-03 確定）
- main ブランチに直接コミットする（worktree 作成禁止）
- worktree が既に存在する場合は、`git worktree remove` で削除してから作業を開始する
- 削除手順は引き継ぎ書 v6 §5 および本ドキュメントの「Git 運用方針」を参照
- `git rebase` / `git reset --hard` / `git commit --amend`（既存コミット対象）は使わない
- push は柴さんの「OK push して」を待つ

### "use client" + Suspense パターン
- `useSearchParams()` を使う場合は Suspense でラップ必須（Next.js 14 要件）
- `useParams()` のみなら Suspense 不要
- Phase 4c（casual-meeting）は Suspense あり、Phase 4d（reserve）は Suspense なし
- **Phase 5 Stage 1**: list/detail pages は Server Component（`async`）にする

### Supabase Server Component パターン
```typescript
// Server Component（async）でのデータ取得
import { getCompanies } from "@/lib/supabase/queries";

export default async function CompaniesPage() {
  const companies = await getCompanies();
  return <CompanyList companies={companies} />;
}
```

### nativeInputValueSetter パターン（React state 更新）
- preview_fill や DOM 直接書き換えでは React state が更新されない
- eval で `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set` を使い、`new Event('input', { bubbles: true })` で発火

### 既知の TypeScript エラー（既存・非クリティカル）
```
src/app/companies/mockCompanies.ts(219,31): error TS2802
  Type 'Set<string>' can only be iterated through when using '--downlevelIteration'
```
- ビルド・動作には影響しない

---

## ✅ Phase 4: Supabase 本番接続フェーズ（完了 2026-04-27）

| ページ | パス | 状態 |
|--------|------|------|
| 企業側ログイン | `/biz/auth` | ✅ 実装済み |
| ダッシュボード | `/biz/dashboard` | ✅ **実データ完全接続（2026-04-27）** |
| 企業情報編集 | `/biz/company` | ✅ **READ + WRITE + Storage（photos + logo）完了** |
| カジュアル面談管理 | `/biz/meetings` | ✅ **Supabase 接続完了** |
| 求人管理 | `/biz/jobs` | ✅ **Supabase 接続完了** |
| 分析 | `/biz/analytics` | 未着手 |

### /biz/company Supabase接続 詳細（2026-04-27 完了）

**新規ファイル:**
- `src/lib/business/company.ts` — DbCompany型, transformDbToForm, transformFormToDb, fetchCompanyForTenant
- `src/app/api/biz/company/route.ts` — PUT（全フィールド自動保存）, PATCH（is_published トグル）
- `src/app/biz/company/CompanyEditClient.tsx` — `"use client"` (~560行), hasInteracted autosave pattern

**変更ファイル:**
- `src/app/biz/company/page.tsx` — async Server Component に書き換え（691行 → 30行）

**重要実装パターン:**
- `hasInteracted = useRef(false)` — React 18 Strict Mode 対策（isFirstRender パターンは NG）
- Client は BizCompany (camelCase) を JSON で送信; Server 側で transformFormToDb を1回だけ呼ぶ
- `ow_user_roles.tenant_id`（primary）+ `ow_companies.user_id .limit(1)`（fallback）で company ID 解決

### Phase 4 で適用した RLS 修正 migration

| Migration | 内容 | ロールバック |
|-----------|------|------------|
| 035 | ow_user_roles RLS 自己参照解消 + tenant_id backfill | `supabase/rollbacks/035_rollback.sql` |
| 036 | auth_is_admin() に SET row_security = off（PG15+ 対応）| `supabase/rollbacks/036_rollback.sql` |
| 037 | ow_company_admins RLS 自己参照解消（auth_is_company_member/admin）| `supabase/rollbacks/037_rollback.sql` |
| 038 | ow_company_office_photos category fix (work→workspace) + WITH CHECK | `supabase/rollbacks/038_rollback.sql` |
| 039 | ow_activities RLS を auth_is_company_member() で統一 + INSERT policy 追加 | `supabase/rollbacks/039_rollback.sql` |

### Phase 4 で構築した Storage 連携

- バケット: `ow-uploads`（Public bucket、既存稼働中を再利用）
- パス規則:
  - `companies/office-photos/{companyId}/{timestamp}.{ext}` (オフィス写真)
  - `companies/logos/{companyId}/{timestamp}.{ext}` (企業ロゴ)
  - `companies/headers/{id}-{timestamp}.{ext}` (既存、admin で使用中)
  - `companies/recruiters/{id}-{timestamp}.{ext}` (既存)
- アップロード: クライアント側で直接 `supabase.storage.from().upload()`
- DB 操作: API Route 経由 (POST / PATCH / DELETE)
- DELETE 時: DB delete → Storage remove（orphan 容認、best-effort）
- ロゴは `<img src>` + gradient/letter fallback の二段階表示

### Phase 4 で得た重要技術知見

1. **PG15+ の SECURITY DEFINER は内部でも RLS が適用される**
   → 関数定義に `SET row_security = off` が必須
2. **Vercel build は ESLint strict mode**
   → 未使用 import が build 失敗の原因になる（ローカル dev は警告のみ）
3. **React 18 Strict Mode の二重 mount**
   → autosave 系では `hasInteracted` ref パターンが安全（`isFirstRender` パターンは NG）
4. **クライアント・サーバーの責務分離**
   → 型変換は API Route 側に集約、クライアントは原 form を送る（double-transform バグを防ぐ）
5. **フォームへの新フィールド追加は 3 層（型 + transformer + JSX）の同期が必須**
   → `BizCompany` 型・DB transformer・表示 JSX のすべてに対応がないと動作しない（logoUrl バグの教訓）
6. **Next.js dev server の .next キャッシュ**
   → ファイル編集中に MODULE_NOT_FOUND が出たら `rm -rf .next && npm run dev` で解決
7. **`.env.development.local` は `.env.local` より優先される**
   → Next.js の環境変数読み込み順序を意識する。`NEXT_PUBLIC_BIZ_MOCK_MODE=true` が残留して本番 DB が見えなくなった経験から
8. **insertActivity の best-effort パターン**
   → ow_activities への INSERT 失敗がユーザー操作（PUT/PATCH 200 レスポンス）をブロックしないよう try/catch で囲む。副作用ログは常に best-effort
9. **getOwUserId のヘルパー化**
   → `auth.uid()`（Supabase Auth UUID）と `ow_users.id`（アプリ内 UUID）の変換は複数 API Route で必要なため共通関数として extract する

### Phase 4 後の dashboard 完全接続（完了 2026-04-27）

| 画面 | コンポーネント | 状態 |
|------|--------------|------|
| /biz/dashboard | ActivityList | ✅ 5 イベント記録（migration 039 + 4 API Route） |
| /biz/dashboard | TeamMembers | ✅ ow_company_admins JOIN ow_users |
| /biz/dashboard | PendingMeetings | ✅ 既存 fetchMeetingsForCompany + adapter |
| /biz/dashboard | MatchCandidates | 🟡 意図的に空（数値データ撤廃方針） |

INSERT パターン（best-effort）:
- `/api/biz/company` PUT → `company_info_updated`
- `/api/biz/jobs/[id]` PUT → `job_updated`
- `/api/biz/jobs/[id]` PATCH (published) → `job_published`
- `/api/biz/meetings/[id]` PATCH (scheduled/completed) → `meeting_scheduled` / `meeting_completed`

---

## 🔧 将来の改善課題

### name 表示の二重経路問題（一部解決 2026-04-27）

**現状（2026-04-27 16:20 時点）:**
- データ修正で柴久人の表示は統一済み（ow_users.name = '柴久人' に UPDATE 実施）
- ただし**根本的な設計問題は未解決**

**問題の構造（2026-04-27 調査結果）:**
- ヘッダー（`src/lib/business/dashboard.ts:146`）: `auth.users.raw_user_meta_data.name` を参照
- TeamMembers（`src/lib/business/team.ts`）: `ow_users.name` を参照
- 両者が常に一致する保証なし
- migration 032 の backfill が `ON CONFLICT (auth_id) DO NOTHING` のため、既存ユーザーは自動同期されない

**今後ユーザー追加時の懸念:**
- 新規ユーザーが auth metadata の name を変更しても、ow_users.name に反映されない
- 採用担当者が複数人いる企業で、一部メンバーだけ古い名前が表示される事故が起きうる

**根本解決の方針案（後日実装、Phase 5 級）:**

| 案 | 方法 | 難易度 | 影響範囲 |
|---|---|---|---|
| A | データ修正 (Quick Fix) ✅ 適用済み | ⭐ | 個別ユーザー対応 |
| B | getTenantContext で ow_users.name 取得し、ヘッダーも統一 | ⭐⭐ | dashboard.ts:146 |
| C | ow_users 更新 trigger で auth metadata と同期 | ⭐⭐⭐ | 新規 migration |
| D | ow_users にプロフィール編集 UI を提供 | ⭐⭐⭐ | /biz/profile 新規 or /biz/auth 拡張、Phase 5 のスコープ |

**推奨アプローチ（後日実装時）:**
- Phase 5 で D を実装し、その際に B も同時に修正
- C はトリガー設計が複雑なため避ける

### 軽い改善
- **ActivityList: autosave 連発による重複行** → 5 分以内の同一 type + actor の更新は 1 件にまとめるか、「公開する」ボタン時のみ INSERT する設計へ変更

### Phase 5 で実装が必要な ActivityList 残り 5 イベント
- `casual_meeting_applied`: 候補者側申込フロー（ow_threads → ow_casual_meetings 移行）
- `offer_sent`: ow_offers テーブル + API 実装
- `message_sent` / `message_received`: 候補者向けメッセージ機能
- `candidate_status_changed`: 候補者ステータス管理機能
- **各機能実装時に `insertActivity()` を追加するだけで dashboard に自動表示される**

---

## コミット履歴（直近 — 2026-05-22）

```
d44e3f3  fix(admin/dashboard): correct stats queries and company status display
da94ab6  feat(admin/jobs): add [id] detail page for job review workflow
bdfa8f7  fix(mypage): replace MOCK_BOOKMARKS_ARTICLES and MOCK_RECEIVED_REQUESTS with real data
d060965  fix(mypage): pass currentRole from real career data to DashboardView
e555cd0  fix(queries): filter ow_jobs by published status in production
fad589c  fix(admin/companies): use is_published boolean instead of non-existent status column
205acb2  fix(admin/jobs): rewrite with correct status values and rejection flow
04c0c23  fix(queries): unify work_style label mapping and deduplicate WORK_STYLE_LABELS
f9d9a7f  fix(jobs): correct double-万 salary display and Japanese work-style labels
c1663a4  feat(dashboard): AL-2 — insert ow_activities from 4 API routes (5 events)
6b9789a  feat(dashboard): AL-1 — wire PendingMeetings, ActivityList, TeamMembers to Supabase
```
