# Opinio Work 現状フルアセスメント — 2026-06-17

> **調査専用レポート。コード・DB変更なし。**  
> 対象リポジトリ: `/Users/hisato/opinio-work/`  
> Supabase プロジェクト: `xtutnecqeamftygufxco`

---

## 1. ページ・ルート一覧

### 1-A. 求職者向け公開ルート（`src/app/(jobseeker)/`）

| ルート | ファイル | 対象 / 概要 |
|--------|---------|-----------|
| `/` | `(jobseeker)/page.tsx` | 全員向け LP — Hero・HowItWorks・PainPoints・企業/メンター/記事プレビュー・FinalCta |
| `/companies` | `(jobseeker)/companies/page.tsx` | 求職者 — 企業一覧（フェーズ/業種/勤務形態/地域フィルター + 企業比較バー） |
| `/companies/[id]` | `(jobseeker)/companies/[id]/page.tsx` | 求職者 — 企業詳細（Hero・求人・現役社員・OB/OG・記事・組織・製品・適合評価） |
| `/companies/[id]/casual-meeting` | `(jobseeker)/companies/[id]/casual-meeting/page.tsx` | 求職者 — カジュアル面談申込フォーム（在籍企業ガード付き） |
| `/companies/[id]/posts` | `(jobseeker)/companies/[id]/posts/page.tsx` | 求職者 — 企業ストーリー公開一覧 |
| `/companies/compare` | `(jobseeker)/companies/compare/page.tsx` | 求職者 — 最大3社の企業横断比較 |
| `/jobs` | `(jobseeker)/jobs/page.tsx` | 求職者 — 求人一覧（サイドバーフィルター + 先輩ロールマッチ + 面談受付トグル） |
| `/jobs/[id]` | `(jobseeker)/jobs/[id]/page.tsx` | 求職者 — 求人詳細（JD・関連先輩・面談CTA） |
| `/jobs/[id]/apply` | `(jobseeker)/jobs/[id]/apply/page.tsx` | 求職者 — 求人応募フォーム |
| `/articles` | `(jobseeker)/articles/page.tsx` | 求職者 — 記事一覧（ow_articles、Supabase接続済み） |
| `/articles/[slug]` | `(jobseeker)/articles/[slug]/page.tsx` | 求職者 — 記事詳細 + 末尾メンターCTAストリップ |
| `/feed` | `(jobseeker)/feed/page.tsx` | 求職者 — SNSフィード（ow_posts + いいね/コメント、実装済み・ナビから除外中） |
| `/posts` | `(jobseeker)/posts/page.tsx` | 求職者 — 公開投稿一覧 |
| `/u/[id]` | `(jobseeker)/u/[id]/page.tsx` | 全員向け — ユーザー公開プロフィール（2カラム、職歴タイムライン、visibility RLS制御） |
| `/profile/edit` | `(jobseeker)/profile/edit/page.tsx` | 求職者（要ログイン）— プロフィール編集（職歴/スキル/学歴/発信コンテンツ/SNS/設定） |
| `/mypage` | `(jobseeker)/mypage/page.tsx` | 求職者（要ログイン）— マイページ（面談/相談/ブックマーク/応募一覧） |
| `/mypage/applications` | `(jobseeker)/mypage/applications/page.tsx` | 求職者（要ログイン）— 応募履歴 |
| `/mypage/conversations` | `(jobseeker)/mypage/conversations/page.tsx` | 求職者（要ログイン）— メッセージ一覧 |
| `/mypage/conversations/[id]` | `(jobseeker)/mypage/conversations/[id]/page.tsx` | 求職者（要ログイン）— リアルタイムメッセージ（Supabase Realtime） |
| `/pricing` | `(jobseeker)/pricing/page.tsx` | 企業向け — 掲載料金（掲載費¥0 + 成果報酬10%） |
| `/industries` | `(jobseeker)/industries/page.tsx` | 求職者 — 業種一覧 |
| `/about` | `(jobseeker)/about/page.tsx` | 全員 — サービス概要 |
| `/about/scope` | `(jobseeker)/about/scope/page.tsx` | 全員 — 掲載企業スコープ説明 |
| `/about/selection-criteria` | `(jobseeker)/about/selection-criteria/page.tsx` | 全員 — 企業審査基準 |
| `/not-job-changing` | `(jobseeker)/not-job-changing/page.tsx` | 全員 — 転職検討中でない人向けLP |

### 1-B. 認証ルート

| ルート | ファイル | 概要 |
|--------|---------|------|
| `/auth` | `(auth)/auth/page.tsx` | メイン認証（signup/login/Google OAuth統合） |
| `/auth/login` | `auth/login/page.tsx` | ログイン専用 |
| `/auth/reset-password` | `auth/reset-password/page.tsx` | パスワードリセット |
| `/auth/update-password` | `auth/update-password/page.tsx` | パスワード更新 |
| `/onboarding` | `onboarding/page.tsx` | 新規登録後オンボーディング（職種/フェーズ/ワークスタイル/悩み 5ステップ） |

### 1-C. 企業担当者向けルート（`/biz/*`、要ログイン）

| ルート | ファイル | 概要 |
|--------|---------|------|
| `/biz/dashboard` | `biz/dashboard/page.tsx` | ダッシュボード（KPI・Activity・PendingMeetings） |
| `/biz/company` | `biz/company/page.tsx` | 企業情報編集（全フィールド + Storage写真） |
| `/biz/companies/add` | `biz/companies/add/page.tsx` | 企業追加ウィザード（new/token/url の3経路） |
| `/biz/jobs` | `biz/jobs/page.tsx` | 求人管理一覧 |
| `/biz/jobs/new` | `biz/jobs/new/page.tsx` | 求人新規作成 |
| `/biz/jobs/[id]/edit` | `biz/jobs/[id]/edit/page.tsx` | 求人編集 |
| `/biz/meetings` | `biz/meetings/page.tsx` | カジュアル面談管理 |
| `/biz/applications` | `biz/applications/page.tsx` | 応募管理（採用確定フロー付き） |
| `/biz/candidates` | `biz/candidates/page.tsx` | 求職者サーチ（500件上限、職種/勤務形態フィルター） |
| `/biz/conversations` | `biz/conversations/page.tsx` | メッセージ管理 |
| `/biz/conversations/[id]` | `biz/conversations/[id]/page.tsx` | メッセージ詳細 |
| `/biz/posts` | `biz/posts/page.tsx` | ストーリー記事 + 外部リンク管理（2タブ） |
| `/biz/members` | `biz/members/page.tsx` | 担当者メンバー管理 |
| `/biz/analytics` | `biz/analytics/page.tsx` | 採用KPI・ファネル・求人パフォーマンス |
| `/biz/organization` | `biz/organization/page.tsx` | 組織図管理 |
| `/biz/pipeline` | `biz/pipeline/page.tsx` | 採用パイプライン |
| `/biz/agents` | `biz/agents/page.tsx` | 人材エージェント連携管理 |
| `/biz/select-company` | `biz/select-company/page.tsx` | テナント企業切り替え |

### 1-D. 管理者ルート（`/admin/*`、要ログイン + admin role）

| ルート | 概要 |
|--------|------|
| `/admin` | 管理者ダッシュボード（KPI4枚） |
| `/admin/companies`, `/admin/companies/[id]` | 企業管理・審査 |
| `/admin/jobs`, `/admin/jobs/[id]` | 求人管理・審査・却下フロー |
| `/admin/articles` | 記事管理 + user_id紐づけUI |
| `/admin/candidates` | 全ユーザー管理 |
| `/admin/invite` | ユーザー招待 |
| `/admin/posts` | 投稿管理 |
| `/admin/school-requests` | 学校マスター申請管理 |

### 1-E. エージェントルート（`/agent/*`）

| ルート | 概要 |
|--------|------|
| `/agent/auth` | エージェントログイン |
| `/agent/dashboard` | 担当求人・候補者一覧 |
| `/agent/recommend/[jobId]` | 特定求人への候補者推薦 |

### 1-F. 孤立・レガシールート（リンクなし・本番不使用）

| ルート | ファイル | 状態 |
|--------|---------|------|
| `/companies/[id]/articles/[articleId]` | `companies/.../articles/[articleId]/page.tsx` | 旧記事ページ、孤立 |
| `/companies/[id]/jobs` | `companies/.../jobs/page.tsx` | 旧求人ページ、孤立 |
| `/companies/[id]/members/[memberId]` | `companies/.../members/[memberId]/page.tsx` | 旧メンバーページ、孤立 |
| `/companies/list` | `companies/list/page.tsx` | 旧企業一覧、孤立 |
| `/users/[id]` | `users/[id]/page.tsx` | `/u/[id]` に移行済み、孤立 |
| `/profile/setup` | `profile/setup/page.tsx` | `ow_user_profiles` 旧テーブル参照、孤立 |
| `/business` | `business/page.tsx` | 旧企業向けLP |
| `/scout` | `scout/page.tsx` | スカウト（未実装・放置） |
| `/_dev/genre-chip-test` | `_dev/genre-chip-test/page.tsx` | 開発用テストページ、本番不使用 |

---

## 2. データモデル（テーブル・カラム・リレーション）

### 2-A. コアテーブル

#### `ow_companies` — 企業マスタ（95+カラム）
```
id (UUID PK)
name, name_en, brand_name, tagline, mission, description
industry, phase, employee_count
location, branch_locations (TEXT[])
remote_work_status, flex_time (BOOL), side_job_ok (BOOL)
accepting_casual_meetings (BOOL), jobs_public (BOOL), is_published (BOOL)
logo_url, logo_gradient, logo_letter, url, x_url, linkedin_url, careers_url
avg_salary, avg_age, female_ratio, funding_total, avg_overtime_hours, paid_leave_rate
fit_positives (TEXT[]), fit_negatives (TEXT[]), benefits (TEXT[])
main_products (TEXT[]), main_customers (TEXT[])
org_teams (JSONB), customer_cases (JSONB), company_features (TEXT[])
culture_description, culture_keywords, why_join, evaluation_system
sort_order
```

#### `ow_jobs` — 求人（50+カラム）
```
id (UUID PK)
company_id (FK→ow_companies)
role_category_id (FK→ow_roles)
title, job_category, employment_type, work_style
location, salary_min, salary_max
status (published/active/draft), published_at
description, requirements, preferred_skills
catch_copy, one_liner, selection_process (TEXT[]), message_to_candidates
why_hire, team_composition, first_90_days, urgency (open/hot)
```

#### `ow_users` — ユーザー（Supabase authと紐づく）
```
id (UUID PK)
auth_id (FK→auth.users.id)
name, email
avatar_color, avatar_url, cover_color, cover_photo_url
visibility (public/login_only/private)
is_mentor (BOOL), is_open_to_work (BOOL), can_casual_meeting (BOOL)
about_me, location, birth_date, future_aspirations
social_links (JSONB), catchphrase
```

#### `ow_mentors` — メンタープロフィール（ow_usersとは独立テーブル）
```
id (UUID PK)
user_id (FK→ow_users, 全件 NULL ← 重大な問題)
name, current_company, current_role (全件 "supabase_read_only_user" バグ)
bio, catchphrase, photo_url, avatar_color, avatar_initial
roles (TEXT[]), question_tags (TEXT[]), concerns
is_available (BOOL), display_order
```

#### `ow_experiences` — 職歴（人とのリレーションの核心）
```
id (UUID PK)
user_id (FK→ow_users)
company_id (FK→ow_companies, nullable)   ← 企業マスタと紐づく
company_text (TEXT)                       ← 自由入力（会社マスタにない場合）
role_category_id (FK→ow_roles)
is_current (BOOL)
started_at, ended_at
```

#### `ow_roles` — 職種マスタ（親子2階層）
```
id (UUID PK)
name
parent_id (self-ref FK→ow_roles)  ← 営業 > インサイドセールス のような階層
```

### 2-B. アクションテーブル

| テーブル | 主要カラム | 役割 |
|---------|-----------|------|
| `ow_casual_meetings` | `id, company_id, user_id, status, scheduled_at` | カジュアル面談申込（申込データ0件） |
| `ow_mentor_reservations` | `id, mentor_id, user_id, status, themes (TEXT[])` | メンター相談予約（予約データ0件） |
| `ow_job_applications` | `id, job_id, user_id, status, hired_confirmed_at, hired_salary` | 求人応募（採用確定カラムあり） |
| `ow_conversations` | `id, company_id, candidate_user_id, mentor_user_id, kind` | メッセージスレッド（カジュアル面談専用設計） |
| `ow_messages` | `id, conversation_id, sender_id, content` | メッセージ本文 |
| `ow_bookmarks` | `id, user_id, target_id, target_type (company/job)` | ブックマーク |
| `ow_activities` | `id, company_id, actor_id, type, description` | bizダッシュボード用アクティビティログ |

### 2-C. プロフィール関連テーブル

| テーブル | 主要カラム | 役割 |
|---------|-----------|------|
| `ow_user_skill_tags` | `user_id, label, sort_order` | スキルタグ |
| `ow_user_educations` | `user_id, school_id (FK→ow_schools), degree, faculty` | 学歴 |
| `ow_schools` | `id, name, logo_url` | 学校マスタ |
| `ow_user_certifications` | `user_id, name, issued_at` | 資格 |
| `ow_user_content_links` | `user_id, url, platform, title, thumbnail_url, sort_order` | 発信コンテンツURL（OGP取得済み） |
| `ow_user_roles` | `user_id, role, tenant_id (FK→ow_companies)` | ユーザーロール（'company'で企業担当者） |
| `ow_profiles` | `user_id, job_type, desired_work_style, desired_phase[], worry` | 希望条件 |

### 2-D. コンテンツテーブル

| テーブル | 役割 |
|---------|------|
| `ow_articles` | 記事（slug, title, is_published, company_id, user_id） |
| `ow_company_posts` | 企業ストーリー（title, content, is_published） |
| `ow_posts` | SNSフィード投稿（content, image_url） |
| `ow_post_likes` | いいね（post_id, user_id） |
| `ow_post_comments` | コメント（post_id, user_id, content） |
| `ow_company_office_photos` | オフィス写真（display_order付き） |
| `ow_company_external_links` | 外部リンク（biz/postsで管理） |

### 2-E. その他テーブル

| テーブル | 役割 |
|---------|------|
| `ow_company_admins` | 企業担当者（user_id, company_id, is_active） |
| `ow_business_monthly_stats` | 月次KPI（0件） |
| `ow_agencies` | 人材エージェント |
| `ow_agency_job_assignments` | エージェント担当求人 |
| `ow_agency_candidates` | エージェント担当候補者 |

### 2-F. テーブルリレーション図（テキスト）

```
auth.users
    │ (auth_id)
    ▼
ow_users ────────────────── ow_user_roles (role='company') ──→ ow_companies
    │                                                               │
    ├─ ow_experiences ──(company_id nullable)───────────────────────┘
    │       └─ ow_roles (role_category_id, 親子2階層)
    │
    ├─ ow_user_skill_tags
    ├─ ow_user_educations ──→ ow_schools
    ├─ ow_user_certifications
    ├─ ow_user_content_links
    ├─ ow_profiles (希望条件)
    ├─ ow_bookmarks (target: company/job)
    ├─ ow_posts ──→ ow_post_likes, ow_post_comments
    ├─ ow_job_applications ──→ ow_jobs ──→ ow_companies
    ├─ ow_casual_meetings ──→ ow_companies
    ├─ ow_mentor_reservations ──→ ow_mentors
    └─ ow_conversations (candidate_user_id, mentor_user_id)
            └─ ow_messages

ow_mentors ──(user_id, 全件NULL)──→ ow_users [断絶中]

ow_companies ──→ ow_jobs
            ──→ ow_articles (company_id)
            ──→ ow_company_posts
            ──→ ow_company_office_photos
            ──→ ow_company_external_links
            ──→ ow_company_admins ──→ ow_users
```

### 2-G. 「人（キャリアプロフィール）」データの現状評価

| 情報 | テーブル | 状況 |
|------|---------|------|
| 現職・前職 | `ow_experiences` + `ow_roles` | ✅ 構造化済み、企業マスタ紐づけあり |
| スキル | `ow_user_skill_tags` | ✅ 自由ラベル |
| 学歴 | `ow_user_educations` + `ow_schools` | ✅ 学校マスタ付き |
| 希望条件 | `ow_profiles` | ✅ job_type/フェーズ/ワークスタイル |
| 発信コンテンツ | `ow_user_content_links` | ✅ OGP・サムネイル取得済み |
| 資格 | `ow_user_certifications` | ✅ あり |
| 転職意欲 | `ow_users.is_open_to_work` | ✅ あり |
| 年収推移 | **なし** | ❌ 未実装（`ow_experiences` に salary カラムなし） |
| 転職理由 | **なし** | ❌ 未実装 |
| キャリア目標 | `ow_users.future_aspirations` | 🟡 自由記述のみ |
| フォロー関係 | **なし** | ❌ SNS化で必要 |
| 推薦コメント | `RecommendationCard.tsx` あり | 🟡 コンポーネントはあるがDBテーブル未確認 |

### 2-H. ユーザー種別の表現

| 種別 | データ上の識別方法 |
|------|-----------------|
| 現役社員 | `ow_experiences.is_current=true AND company_id IS NOT NULL` |
| OB/OG | `ow_experiences.is_current=false AND company_id IS NOT NULL` |
| 求職者 | `ow_users.is_open_to_work=true` または `ow_profiles.worry` |
| メンター | `ow_users.is_mentor=true`（アプリ側フラグ）または `ow_mentors` テーブル（断絶中） |
| 企業担当者 | `ow_user_roles.role='company'` + `tenant_id` |
| 管理者 | `ow_user_roles.role='admin'`（推定） |

### 2-I. 求人と「人」の紐づき状況

| 紐づき | 状況 |
|--------|------|
| 求人 → 企業 | ✅ `ow_jobs.company_id` |
| 求人 → 先輩（ロールマッチ） | ✅ `getJobAlumniMap()`（`JOB_TO_ROLE_NAMES` マッピング経由） |
| 求人 → position_members（在籍者スナップショット） | ❌ DBテーブルなし、全件空配列 |
| 企業 → 現役社員/OB | ✅ `ow_experiences.company_id` 経由で `CurrentEmployeesSection`/`AlumniSection` |

---

## 3. 認証・登録フロー

### 3-A. 認証方式
- Supabase Auth（`@supabase/ssr` v0.10.0）
- ミドルウェア: `src/middleware.ts` — `/biz/*` と `/admin/*` に認証ガード（未ログイン→リダイレクト）
- jobseeker側は**ページレベルで `redirect()`**（middleware保護なし）
- dev環境: `process.env.BIZ_MOCK_MODE=true` でbiz認証スキップ

### 3-B. 公開（認証不要）ルート
```
/  /companies  /companies/[id]  /jobs  /jobs/[id]
/articles  /articles/[slug]
/u/[id]（visibility=public のユーザーのみ RLS で制御）
/auth  /onboarding  /pricing  /about/*  /terms  /privacy  /business
```

### 3-C. 認証必須ルート（ページレベルで redirect）
```
/mypage  /profile/edit
/companies/[id]/casual-meeting
/mentors/[id]/reserve
/biz/*（middleware）
/admin/*（middleware）
/feed（未ログインでも閲覧可、投稿不可）
```

### 3-D. RLS 主要設計
- `ow_users.visibility`: `public` / `login_only` / `private` の3段階（`/u/[id]` で制御）
- `ow_conversations`: `candidate_user_id` / `mentor_user_id` / 企業admin / platformadmin のみ閲覧可（Migration 170で修正済み）
- `ow_bookmarks`: 自分のレコードのみ

---

## 4. 既存コンポーネント資産

### 4-A. 共通UI（`src/components/common/`, `src/components/ui/`）
- `Avatar.tsx` — グラデーション+イニシャル+photo_url の3層フォールバック
- `StatusPill.tsx` — ステータス6色ピル（pending/royal/purple/gray/error/success）
- `GlobalToast.tsx` — グローバルトースト（`src/lib/toast.ts` カスタムイベントバス）
- `ConfirmDialog.tsx` — 確認ダイアログ
- `GenreChipSelector.tsx` — ジャンルチップ選択
- `ImageUpload.tsx` — 画像アップロード（Supabase Storage直接アップ）
- `InitialAvatar.tsx` — イニシャルアバター

### 4-B. プロフィール系（`src/components/profile/`）
- `MergedTimeline.tsx` — 職歴+学歴を時系列マージ、company_idリンク付き、パルスアニメーション
- `CareerHistoryEditor.tsx` — 職歴CRUD（会社名3モード: master/テキスト/匿名）
- `UserProfileCard.tsx` — ユーザーカード（公開プロフィールリンク付き）
- `ProfileShareButton.tsx` — URL共有 + X(Twitter)シェア
- `DMButton.tsx` — DM送信ボタン
- `ProfileNavClient.tsx` — プロフィール内スティッキーナビ
- `RecommendationCard.tsx` / `RecommendationForm.tsx` — 推薦コメント
- `PostCard.tsx` / `PostComposer.tsx` — SNS投稿カード・作成フォーム
- `InlineEditableField.tsx` / `InlineEditableSection.tsx` — インライン編集フィールド

### 4-C. 企業系（`src/components/companies/`）
- `CompanyCardCompact.tsx` — 企業カード（ブックマーク+比較ボタン付き）
- `CompanyCardHoverWrap.tsx` — ホバープレビューラッパー（≥1440px）
- `CompanyLogoImage.tsx` — ロゴ（URL/グラデーション/レター の3層フォールバック）
- `CompareBar.tsx` — 企業比較バー（固定フッター、localStorage同期）
- `CompanySearchBar.tsx` — 検索＋フィルターバー
- `CompaniesFilterSidebar.tsx` — サイドバーフィルター

### 4-D. Jobseeker共通（`src/components/jobseeker/`）
- `JobseekerHeader.tsx` — ヘッダー（検索オーバーレイ付き）
- `JobseekerFooter.tsx` — フッター
- `MobileBottomNav.tsx` — モバイルボトムナビ（5タブ: 企業/求人/フィード/記事/マイページ）
- `FloatingCTA.tsx` — Floating CTAボタン（variant: royal/warm）
- `BookmarkButton.tsx` — ブックマークボタン
- `JobMobileStickyBar.tsx` — 求人詳細モバイル固定CTA
- `JobShareButton.tsx` — 求人シェアボタン

### 4-E. ビジネス系（`src/components/business/`）
- `BusinessLayout.tsx` — bizサイドバーレイアウト
- `JobEditForm.tsx` — 求人編集フォーム（全フィールド）
- `MeetingDetailPanel.tsx` — 面談詳細パネル
- `ActivityList.tsx` — アクティビティフィード（9イベントタイプ）
- `MarkdownEditor.tsx` — Markdownエディタ

---

## 5. レコメンド/検索の実装状況

### 5-A. 企業検索（`src/lib/search/companies.ts`）

**実装済み:**
- テキスト検索: スペース区切りAND検索、`name | description | industry | tagline` を `ILIKE` 照合
- フェーズフィルター: `PHASE_FILTER_MAP`（UI表示名 → DB英語/日本語両対応）で `.in("phase", [...])`
- 業種フィルター: `src/lib/search/industryGroups.ts` の `INDUSTRY_GROUPS`（38業種→8カテゴリ）
- 外資系フィルター: **クライアント側** 企業名パターンマッチ（" Japan" / "Inc" / 法人格なし+英語名）
- 募集中フィルター: **アプリ側** `hiringSet`（ow_jobsのcompany_idセット）との照合
- ソート: `updated_at`（デフォルト）/ `employee_count` / フェーズ順（クライアント側 `PHASE_ORDER`）

**コードコメントに記載された将来拡張パス:**
```
Phase 2: pg_trgm + trigram インデックス（ILIKEをsimilarityに差し替え）
Phase 3: pgvector + embedding（類似度スコア統合）
Phase 4: LLMによるクエリ解釈前処理
```

### 5-B. 求人検索（`src/app/(jobseeker)/jobs/JobsClient.tsx`）

- **クライアント側フィルタリング**（全件取得後インメモリ）
- フィルター: 職種（job_category ILIKE）/ 勤務形態 / 年収下限 / 都道府県 / 面談受付中
- グルーピング: 同一企業3件上限（展開ボタンで全表示可）

### 5-C. 先輩マッチング（`src/lib/supabase/queries.ts` の `getJobAlumniMap`）

- `JOB_TO_ROLE_NAMES` マッピング: `ow_jobs.job_category` → `ow_roles.name`
- `ow_experiences.role_category_id` FK → `ow_roles` 親ロール階層で照合
- ロール一致先輩を優先表示、一致ゼロ時は全先輩にフォールバック

### 5-D. 類似企業レコメンド（`getSimilarCompanies`）

- 同業界×異フェーズで最大4社 → フォールバック: 業界問わず異フェーズ
- シンプルな rule-based（ベクトル検索なし）

### 5-E. レコメンド・AI検索の状況

- **機械学習・ベクトル検索: 未実装**
- `pg_trgm` / `pgvector` はコメントに言及のみ
- パーソナライズ（ユーザーの閲覧履歴・スキルに基づく推薦）: **未実装**

---

## 6. モバイル対応の現状

### 6-A. 対応済み
- `MobileBottomNav` — 5タブ固定フッター、`md:hidden` + `.mobile-bottom-nav-root` 二重制御、`env(safe-area-inset-bottom)` 対応
- `JobMobileStickyBar.tsx` — 求人詳細モバイル固定CTA
- 企業一覧: `@media (max-width: 767px)` で `.job-list-mobile-hide` クラスで情報圧縮
- `JobseekerHeader` 検索オーバーレイ（Escape閉じ対応）
- `/u/[id]` プロフィール: 900px以下で1カラムフォールバック
- h1フォントサイズ: `clamp(28px, 3.8vw, 46px)` 対応済み
- Tailwind `grid-cols-1 md:grid-cols-2` パターンを多用

### 6-B. 未対応・懸念点
- **biz側（`/biz/*`）は完全デスクトップ専用**。モバイルナビなし
- admin側も同様
- ホバープレビューパネル（CompanyCardHoverWrap）は ≥1440px 限定のため、1280〜1439px でサイドバーフィルターと競合する帯が存在
- CSSはTailwindとinline styleが混在（`md:hidden` と `style={{ display: 'none' }}`）
- 企業詳細ページ（`/companies/[id]`）の `org_teams` / `customer_cases` / `ProductsClient` 等の高密度セクションはモバイルでの評価が未実施

---

## 7. ダミー/未完成データの所在

### 7-A. mockファイルを参照し続けているページ

| ファイル | mock内容 | 注記 |
|---------|---------|------|
| `src/app/companies/mockCompanies.ts` | Company型定義・ヘルパー | 型として `companies/[id]/page.tsx` が import継続 |
| `src/app/companies/[id]/mockDetailData.ts` | CompanyDetail型、JobCat型 | 型定義のみ（データはDB） |
| `src/app/mypage/mockMypageData.ts` | Bookmark/CasualMeeting型 | 型のみ |
| `src/app/jobs/mockJobData.ts` | Job型定義 | 型として参照 |
| `src/app/articles/mockArticleData.ts` | 記事型・バッジ定義 | `ow_articles` DB接続済みだが型参照継続 |
| `src/app/(jobseeker)/companies/[id]/casual-meeting/page.tsx` | `MOCK_PROFILE.experiences` で在籍チェック | 実ユーザーDBに未移行 |
| `src/app/profile/setup/page.tsx` | `ow_user_profiles` 旧テーブル参照 | 孤立ページ、本番では使われない |

### 7-B. dev環境のみで有効なモック動作
- `process.env.BIZ_MOCK_MODE === "true"` → biz認証スキップ
- `process.env.NODE_ENV !== "development"` → `is_published` フィルター無効化（全企業表示）

### 7-C. 本番で0件・空表示のセクション
| 画面・データ | 状態 |
|-------------|------|
| `/biz/analytics` グラフ | `ow_business_monthly_stats` 0件 → 全グラフ0表示 |
| `position_members`（求人詳細の在籍者スナップショット） | DBテーブルなし、全件空配列 |
| `member_avatars`（求人詳細） | 全件空配列 |
| `ow_casual_meetings` | 申込データ0件 |
| `ow_mentor_reservations` | 予約データ0件 |
| `ow_mentors.current_role` | 全件 "supabase_read_only_user"（バグ）→ `roles[0]` で代替中 |
| `ow_mentors.user_id` | 全件 NULL（メンター↔ユーザーアカウント断絶） |

### 7-D. その他のプレースホルダー
- `lib/services.ts` / `app/business/page.tsx` の `AGENT_PICK_LAUNCH = "Coming 2026"` — 日付未定
- `biz/organizations/page.tsx` など一部bizページ — 中身が「準備中」の可能性あり（未確認）
- スカウト機能 (`/scout`) — 完全未実装

---

## 8. 人軸SNSへ転換する上での技術的ボトルネック TOP5

### ① `ow_mentors` と `ow_users.is_mentor` の二重人格問題（最重要）

`ow_mentors` テーブルと `ow_users.is_mentor` フラグが並存し、`ow_mentors.user_id` は**全件 NULL**。メンターとユーザーアカウントが実質的に切り離されており、「誰でもメンターになれるSNS」への転換時に根本的な再設計が必要。

- 影響ファイル: `src/lib/supabase/queries.ts`（`getMentors()`）、`/mentors/[id]/page.tsx`、`CompanyMentorsSection`
- 追加バグ: `ow_mentors.current_role` が全件 "supabase_read_only_user"（`roles[0]` で代替中）
- 必要な対応: `ow_mentors` を `ow_users` に 1:1 JOIN 化、または `ow_mentors` を廃止して `ow_users` にメンター属性カラムを移設

### ② フィード（`ow_posts`/`/feed`）が孤立した隠し機能になっている

`/feed` ページと `ow_posts` / `ow_post_likes` / `ow_post_comments` テーブルは実装済みだが、**ヘッダーナビから除外**されており（セッション11で削除）、ユーザーが辿り着けない状態。SNSピボットではフィードがコア機能になるが、現状は"なかったこと"扱い。

- 影響ファイル: `src/components/jobseeker/JobseekerHeader.tsx`（NAV_LINKSにfeedなし）、`src/components/jobseeker/MobileBottomNav.tsx`（フィードタブは存在する）
- 必要な対応: フィードのUI・UX再設計、ヘッダー復帰、`ow_post_comments` フロー審査

### ③ 求人検索がクライアント側フィルタに依存しておりスケールしない

`JobsClient.tsx` は全件取得後インメモリフィルタリング。`companies.ts` の外資系フィルター・募集中フィルターもクライアント側処理。現在（34社・150求人）では問題ないが、SNS化でコンテンツが10倍になると致命的なパフォーマンス劣化が発生する。

- 影響ファイル: `src/app/(jobseeker)/jobs/JobsClient.tsx`、`src/lib/search/companies.ts`
- 必要な対応: `pg_trgm` インデックス化、`is_foreign` フラグの DB カラム追加、サーバー側ページネーション実装

### ④ 型定義が `src/app/` 以下の mock ファイルに散在している

`queries.ts` が `import type { Company } from "@/app/companies/mockCompanies"` など、mockデータファイルから型をimportしている。SNSピボットで新テーブル・新型を追加するたびに「どこに型を置くか」が曖昧になり、技術的債務が蓄積し続ける。

- 影響ファイル: `src/app/companies/mockCompanies.ts`、`mockDetailData.ts`、`mockJobData.ts`、`mockArticleData.ts`
- 必要な対応: `src/types/` 以下に集約し、mock依存を `queries.ts` から排除

### ⑤ `ow_conversations` がカジュアル面談専用設計でユーザー間DMに拡張できない

`ow_conversations` は `candidate_user_id`, `mentor_user_id`, `company_id`, `kind` というスキーマで、採用文脈のメッセージ専用に設計されている。`kind='direct_message'` で `mentor_user_id` をDM受信者として転用しているが（Migration 170）、これは応急処置。SNSフィードへのコメント返信・フォロー機能・ユーザー間フリーDMとの統合が構造的に困難。

- 影響ファイル: `src/app/(jobseeker)/mypage/conversations/`, `src/app/biz/conversations/`, Migration 170
- 必要な対応: `ow_direct_messages` テーブルを `(sender_id, recipient_id, content)` で別途作成。`ow_conversations` は採用フロー専用として残す

---

*レポート生成日: 2026-06-17*  
*調査方法: コード読み取り専用（変更なし）*  
*対象ブランチ: main（commit 87d688f 時点）*
