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

## 🎯 次のセッションでやること（2026-05-23 セッション7 更新）

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
- ~~SEO / OGP 強化~~ ✅ 完了済み（企業詳細・求人詳細・メンター・記事 全ページに generateMetadata + og:image）
- ~~新機能検討~~ ✅ `/u/[id]` 公開プロフィール・`/biz/candidates` 両方実装済み
- ~~求職者プロフィール完成度~~ ✅ 完了済み（希望条件タブ・7項目完成度チェック 2026-05-23 セッション3）
- ~~ow_users.visibility の UI 動作確認~~ ✅ RLS 確認済み（public/login_only/private それぞれ正しく動作）
- ~~biz側 desired_phase フィルター~~ ✅ 完了済み（ピルボタン UI に変更済み 2026-05-23 セッション6）
- **ow_profiles への実データ投入確認** — 実ユーザーを招待し、オンボーディング → profile/edit 希望条件 → /biz/candidates に表示される E2E フローを確認
- **実ユーザー招待・オンボーディング** — DB・機能・UI 全て準備完了。企業担当者＋求職者を招待してテスト可能

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
