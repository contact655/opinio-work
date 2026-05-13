# Phase 2 事前調査レポート: YOUTRUST型オンボーディングフロー

作成日: 2026-05-13
調査者: Claude Code

---

## 1. 既存APIルートの一覧

### /api/biz/ — 企業担当者向け

| ルート | メソッド | 責務 |
|--------|---------|------|
| `/api/biz/company` | PUT | 企業情報全フィールド更新（自動保存トリガー） |
| `/api/biz/company` | PATCH | `is_published` トグル（公開/非公開切替） |
| `/api/biz/company/photos` | POST | オフィス写真 1 件アップロード |
| `/api/biz/company/photos/[id]` | PATCH | 写真メタ情報更新（caption/category等） |
| `/api/biz/company/photos/[id]` | DELETE | 写真削除（DB + Storage） |
| `/api/biz/company/employee-categories` | POST | 社員カテゴリ 1 件追加 |
| `/api/biz/company/employee-categories` | PUT | 社員カテゴリ一括更新（並び順） |
| `/api/biz/company/employee-categories/[id]` | DELETE | 社員カテゴリ 1 件削除 |
| `/api/biz/jobs` | POST | 求人新規作成 |
| `/api/biz/jobs/[id]` | PUT | 求人全フィールド更新 |
| `/api/biz/jobs/[id]` | PATCH | 求人ステータス変更（published/archived等） |
| `/api/biz/jobs/[id]` | DELETE | 求人削除 |
| `/api/biz/meetings/[id]` | PATCH | カジュアル面談ステータス更新（scheduled/completed） |
| `/api/biz/members` | POST | メンバーを ow_company_admins に追加（既存ユーザー向け） |
| `/api/biz/members/[id]` | PATCH | メンバー権限変更（admin/member）・ロールタイトル更新・有効/無効切替 |
| `/api/biz/members/[id]` | DELETE | メンバー削除（is_active=false に更新） |
| `/api/biz/members/invite` | POST | 招待メール送信 + ow_invitations レコード作成 |
| `/api/biz/members/accept` | POST | 招待受諾処理（ow_invitations → ow_company_admins） |
| `/api/biz/applications/[id]` | PATCH | 応募ステータス更新 |
| `/api/biz/conversations/[id]/join` | POST | 会話への参加（企業担当者がスレッドに参加） |
| `/api/biz/conversations/[id]/messages` | POST | 会話へのメッセージ送信 |
| `/api/biz/switch-company` | POST | 複数企業所属時の企業切替（cookie `biz_current_company_id` 更新） |

### /api/admin/ — 管理者向け

| ルート | メソッド | 責務 |
|--------|---------|------|
| `/api/admin/companies/[id]` | PUT | 管理者による企業情報更新 |
| `/api/admin/companies/[id]/genres` | POST | 企業ジャンル追加 |
| `/api/admin/companies/[id]/genres` | DELETE | 企業ジャンル削除 |
| `/api/admin/school-requests` | GET | 学校申請一覧取得 |
| `/api/admin/school-requests/[id]/approve` | POST | 学校申請承認 |
| `/api/admin/school-requests/[id]/reject` | POST | 学校申請却下 |

### /api/jobseeker/ — 求職者向け

| ルート | メソッド | 責務 |
|--------|---------|------|
| `/api/jobseeker/profile` | PUT | プロフィール基本情報更新 |
| `/api/jobseeker/experiences` | GET | 職歴一覧取得 |
| `/api/jobseeker/experiences` | POST | 職歴新規作成 |
| `/api/jobseeker/experiences/[id]` | PUT | 職歴更新 |
| `/api/jobseeker/experiences/[id]` | DELETE | 職歴削除 |
| `/api/jobseeker/educations` | GET/POST | 学歴一覧取得・新規作成 |
| `/api/jobseeker/educations/[id]` | PUT/DELETE | 学歴更新・削除 |
| `/api/jobseeker/certifications` | GET/POST | 資格一覧取得・新規作成 |
| `/api/jobseeker/certifications/[id]` | PUT/DELETE | 資格更新・削除 |
| `/api/jobseeker/achievements` | GET/POST | 実績一覧取得・新規作成 |
| `/api/jobseeker/achievements/[id]` | PUT/DELETE | 実績更新・削除 |
| `/api/jobseeker/awards` | GET/POST | 受賞歴一覧取得・新規作成 |
| `/api/jobseeker/awards/[id]` | PUT/DELETE | 受賞歴更新・削除 |
| `/api/jobseeker/media-appearances` | GET/POST | メディア掲載一覧取得・新規作成 |
| `/api/jobseeker/media-appearances/[id]` | PUT/DELETE | メディア掲載更新・削除 |
| `/api/jobseeker/skill-tags` | GET/POST | スキルタグ一覧取得・追加 |
| `/api/jobseeker/skill-tags/[id]` | DELETE | スキルタグ削除 |
| `/api/jobseeker/experience-stories` | GET/POST | 経験ストーリー一覧取得・新規作成 |
| `/api/jobseeker/experience-stories/[id]` | PUT/DELETE | 経験ストーリー更新・削除 |
| `/api/jobseeker/experience-stories/reorder` | PATCH | 経験ストーリー並び順更新 |
| `/api/jobseeker/experience-story-sections` | GET/POST | ストーリーセクション取得・新規作成 |
| `/api/jobseeker/experience-story-sections/[id]` | PUT/DELETE | ストーリーセクション更新・削除 |
| `/api/jobseeker/experience-story-sections/reorder` | PATCH | ストーリーセクション並び順更新 |
| `/api/jobseeker/school-requests` | POST | 学校申請送信 |
| `/api/jobseeker/ogp-fetch` | POST | URL の OGP 情報取得（外部フェッチ） |

### その他

| ルート | メソッド | 責務 |
|--------|---------|------|
| `/api/applications` | POST | 求人応募送信（候補者側） |
| `/api/bookmarks` | POST/DELETE | 企業・求人ブックマーク追加・解除 |
| `/api/casual-meetings` | POST | カジュアル面談申込（候補者側） |
| `/api/company/register` | POST | 企業新規登録（ow_companies + ow_company_admins 作成） |
| `/api/company/me` | GET/PUT | 自社情報取得・更新（レガシー） |
| `/api/company/import` | POST | 企業情報インポート |
| `/api/company/jobs` | GET | 自社求人一覧取得 |
| `/api/consultation-request/notify` | POST | 相談申込通知メール送信 |
| `/api/consultation/book` | POST | 相談予約確定 |
| `/api/mentor-reservations` | POST | メンター予約申込 |
| `/api/roles` | GET/POST | ロール一覧取得・追加 |
| `/api/jobs/count` | GET | 求人件数取得 |
| `/api/newsletter/subscribe` | POST | メールマガジン購読登録 |
| `/api/save-company` | POST | 企業保存（ブックマーク系） |
| `/api/cron/weekly-jobs` | GET | 週次求人メール配信 cron |
| `/api/cron/weekly-match` | GET | 週次マッチング処理 cron |
| `/api/migrate` | POST | DB マイグレーション実行（開発用） |
| `/api/setup-tables` | GET | テーブル初期設定（開発用） |

---

## 2. /biz/ 配下のページ実装状況

| ページ | パス | 状態 | 備考 |
|--------|------|------|------|
| 企業ログイン/サインアップ | `/biz/auth` | ✅ 実装済み | Supabase Auth + 企業情報登録フロー（1,135行） |
| 企業サインアップ専用 | `/biz/auth/signup` | ✅ 実装済み | /biz/auth の signup モードの別パス |
| 招待受諾 | `/biz/auth/accept-invite` | ✅ 実装済み | ow_invitations → ow_company_admins 登録 |
| ダッシュボード | `/biz/dashboard` | ✅ 実装済み | Supabase 完全接続（activities/team/meetings/jobs） |
| 企業情報編集 | `/biz/company` | ✅ 実装済み | READ + WRITE + Storage（photos + logo）完了 |
| 社員カテゴリ編集 | `/biz/company/employees/categories` | ✅ 実装済み | ow_company_employee_categories CRUD |
| 求人管理一覧 | `/biz/jobs` | ✅ 実装済み | Supabase 接続済み（JobsClient） |
| 求人作成 | `/biz/jobs/new` | ✅ 実装済み | Supabase 接続済み（JobEditForm） |
| 求人編集 | `/biz/jobs/[id]/edit` | ✅ 実装済み | Supabase 接続済み（fetchJobById） |
| チーム管理 | `/biz/members` | ✅ 実装済み | ow_company_admins 完全接続（MembersClient） |
| 面談管理 | `/biz/meetings` | 🟡 部分実装 | MeetingsClient + MeetingsMockView 両方存在 |
| 応募管理 | `/biz/applications` | 🟡 部分実装 | ApplicationsClient 実装済みだが詳細不明 |
| 会話一覧 | `/biz/conversations` | 🟡 部分実装 | ページ + 詳細ページあり |
| 会話詳細 | `/biz/conversations/[id]` | 🟡 部分実装 | JoinButton + ReplyForm あり |
| 投稿管理 | `/biz/posts` | 🟡 部分実装 | Server Actions あり（createPost/deletePost/updatePost） |
| 企業追加 | `/biz/companies/add` | ✅ 実装済み | 3方式（new/token/url）での企業追加フロー |
| 企業新規作成 | `/biz/companies/add/new` | ✅ 実装済み | CreateCompanyClient |
| トークンで追加 | `/biz/companies/add/token` | ✅ 実装済み | AddByTokenClient |
| URLで追加 | `/biz/companies/add/url` | ✅ 実装済み | AddByUrlClient |
| 企業選択 | `/biz/select-company` | ✅ 実装済み | 複数企業所属時の切替 UI |

### 各ページ詳細

#### /biz/dashboard（✅ 実装済み）
Supabase から以下を並列取得して表示:
- `getTodoCounts`, `getMonthlyStats`, `getJobPerformance`, `getJobStatusCounts` — 統計・TODOカウント
- `fetchPendingMeetingsForDashboard` — 対応待ちカジュアル面談
- `fetchActivitiesForDashboard` — アクティビティログ（5種イベント）
- `fetchTeamMembersForDashboard` — チームメンバー
- テナントなし時は「企業アカウントを追加」導線を表示

#### /biz/company（✅ 実装済み）
編集可能なフィールド（CompanyEditClient で管理、自動保存700msデバウンス）:
- 基本情報: 名前/タグライン/ミッション/業界/フェーズ/従業員数/設立年
- 詳細情報: fit_positives/fit_negatives/why_join/description
- 働き方: リモート/フレックス/副業 フラグ
- ロゴ: logo_url / logo_gradient / logo_letter
- オフィス写真（ow_company_office_photos）: アップロード・削除・並び順
- 公開/非公開トグル（is_published）

#### /biz/jobs/new と /biz/jobs/[id]/edit（✅ 実装済み）
- 共通の `JobEditForm` コンポーネントを使用
- `mode="new"` or `mode="edit"` で動作切替
- Supabase 接続済み（`fetchJobById`, `fetchTeamMembers`）

#### /biz/members（✅ 実装済み）
- `fetchMembersForCompany`, `fetchPendingInvitesForCompany` でデータ取得
- MembersClient で admin/member 権限切替・招待・無効化の UI 実装
- ow_company_admins テーブルを直接管理

#### /biz/auth（✅ 実装済み）
- Supabase Auth（メールパスワード）でサインアップ/ログイン
- サインアップ時: メール確認 → 企業情報入力 → `/api/company/register` → ow_companies + ow_company_admins 作成
- ログイン時: supabase.auth.signInWithPassword → redirect
- 法人メールドメイン判定（gmail.com等は警告表示）

---

## 3. ヘッダー・モード切替UIの現状

- 状態: 🟡 部分実装（候補者/採用担当 のナビ切替はあるが、ページ内でのモード切替スイッチなし）

### 実装済み内容（`src/components/Header.tsx`）

**ロール判定ロジック:**
```
isCompany = roles.includes("company")
isCandidate = roles.includes("candidate")
hasBothRoles = isCompany && isCandidate
isCompanyOnly = isCompany && !isCandidate
```

**ロール取得方法:** `/api/roles` エンドポイントに fetch → `data.roles` 配列を取得

**ナビ切替ルール:**
- 未ログイン → 候補者ナビ（求人を探す / 企業を知る / メンターに相談）
- hasBothRoles → 候補者ナビを表示（採用担当ナビには自動切替しない）
- isCompanyOnly → 採用担当ナビ（求人を管理する / 企業プロフィール / 求人を作成）
- candidate のみ → 候補者ナビ

**ユーザーアバター・ドロップダウン:**
- ログイン済みの場合: Userアイコン（36px 丸ボタン）+ ドロップダウン
- ドロップダウン内: マイページリンク / ログアウトボタン

**新着求人バッジ:**
- `ow_profiles.last_login_at` 以降に作成された `ow_jobs` 件数をバッジ表示

**未実装 / 課題:**
- `hasBothRoles` の場合、採用担当モードへの切替 UI が存在しない（採用担当ページへは直リンクのみ）
- YOUTRUST 型「個人モード ↔ 採用担当モード」のトグルスイッチは未実装
- BusinessLayout（/biz/ 配下）は別の Header を持つ（ `src/components/business/BusinessLayout.tsx`）

---

## 4. 経歴（experiences）関連の実装状況

### ow_experiences テーブル: ✅ 存在する

**マイグレーション:** `supabase/migrations/031_opinio_phase1_core_schema.sql`

**テーブル定義（主要カラム）:**
```sql
CREATE TABLE IF NOT EXISTS ow_experiences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,

  -- 会社（3パターン、どれか1つだけ入る）
  company_id          UUID REFERENCES ow_companies(id) ON DELETE SET NULL,
  company_text        TEXT,
  company_anonymized  TEXT,

  -- 職種
  role_category_id    UUID NOT NULL REFERENCES ow_roles(id),
  role_title          TEXT,

  -- 期間
  started_at          DATE NOT NULL,
  ended_at            DATE,
  is_current          BOOLEAN NOT NULL DEFAULT false,

  description         TEXT,
  display_order       INT NOT NULL DEFAULT 0,

  -- 制約: 3パターンのうち必ず1つは入ること
  CONSTRAINT experience_company_xor CHECK (...)
);
```

RLS: `ow_experiences_public_read`（公開）/ `ow_experiences_login_only_read`（ログイン必須）/ `ow_experiences_own_manage`（自分のみ管理可能）の3ポリシー構成。

**追加マイグレーション:** `076_add_why_to_experiences.sql` で `why` カラム追加（詳細不明）。

### career_history カラム: ✅ 存在する（ow_users テーブル）

`supabase/migrations/024_company_p2_functional.sql` で `ow_users` テーブルに `career_history jsonb` カラムを追加済み。ただし `ow_experiences` テーブルが主要なストレージであり、`career_history` はレガシーまたは補助的用途と思われる。

### 経歴入力UI: ✅ 実装済み（求職者側）

- **API:** `/api/jobseeker/experiences` (GET/POST) と `/api/jobseeker/experiences/[id]` (PUT/DELETE) が実装済み
- **フロントエンド:** `src/app/(jobseeker)/profile/edit/` 配下に ProfileEditClient.tsx + CareerModal.tsx あり
- **ow_experience_stories テーブル:** `supabase/migrations/089_create_ow_experience_stories.sql` で追加（構造化された経験ストーリー機能）

### 現役社員/OB-OG セクション: ✅ 実装済み（企業詳細ページ）

- **ファイル:** `src/app/(jobseeker)/companies/[id]/page.tsx`（2,765行）
- **実装:** `getCompanyEmployees(companyId)` を Supabase から取得
  - `current`（現役社員）: `ow_experiences` の `is_current=true` かつ `company_id` 一致
  - `alumni`（OB・OG）: `ow_experiences` の `is_current=false` かつ `ended_at` あり
- `CompanyEmployee` 型: userId, name, avatarInitial, avatarGradient, roleTitle, isMentor, endedAt, roleCategoryId/Name, roleParentId/Name

---

## 5. 認可・セッション管理の現状

### middleware.ts（`src/middleware.ts`）

**保護対象:**
- `/biz/**`（`/biz/auth`, `/biz/auth/signup`, `/biz/auth/accept-invite` は除外）
- `/admin/**`

**認証チェック:** `supabase.auth.getUser()` で未ログインなら `/biz/auth?next={pathname}` にリダイレクト

**企業ロール確認:** middleware では行わない。各ページ/API Route で `getTenantContext()` を呼び、null なら企業アカウント追加導線を表示。

**モックモード:** `BIZ_MOCK_MODE=true` の場合は認証チェックをスキップ（dev 専用）。

### getTenantContext()（`src/lib/business/dashboard.ts`）

**処理フロー:**
1. `supabase.auth.getUser()` でログインユーザー取得
2. cookie `biz_current_company_id` から現在の企業 ID を取得
3. `getCompanyContext()` で `ow_company_admins` からユーザーの所属企業一覧を取得
4. 複数企業所属 + cookie なし → `/biz/select-company` にリダイレクト
5. `ow_companies` から企業情報（name, logo_gradient, logo_letter）を取得
6. `ow_users.avatar_color` を取得
7. `ow_tenant_plans` から plan_type を取得（テーブルなし時は null でフォールバック）
8. `user.user_metadata.name || email.split("@")[0]` で userName を決定

**戻り値:** `TenantContext | null`（テナントなし/未ログイン時は null）

### isAdmin()（`src/lib/auth/isAdmin.ts`）

**判定ロジック:**
1. プライマリ: `supabase.rpc("auth_is_admin")` — ow_user_roles で role='admin' 確認
2. フォールバック: `ADMIN_EMAILS` 環境変数でメールアドレス照合（開発・緊急時用）

### ow_company_admins チェック箇所

| ファイル | 用途 |
|---------|------|
| `src/lib/roles.ts` | `getUserRoles()` — company ロール判定（is_active=true 行の存在確認） |
| `src/app/biz/auth/page.tsx` | サインアップ時に ow_company_admins へ初回登録 |
| `src/app/biz/auth/accept-invite/page.tsx` | 招待受諾時に ow_company_admins へ追加 |
| `src/app/api/biz/members/_lib.ts` | メンバー追加共通ロジック |
| `src/app/api/biz/members/[id]/route.ts` | 権限変更・無効化 |
| `src/app/api/biz/members/invite/route.ts` | 招待前の重複チェック |
| `src/app/api/biz/conversations/[id]/join/route.ts` | 会話参加権限確認 |

### ロール管理（`src/lib/roles.ts`）

`UserRole` = `"candidate" | "company" | "admin"`

- `candidate` / `admin` → `ow_user_roles` テーブル（`user_id`, `role`）
- `company` → `ow_company_admins.is_active=true` の存在で判定（ow_user_roles には入れない）
- Header.tsx は `/api/roles` エンドポイント経由で取得し、`roles.includes("company")` で判定

---

## Phase 2 実装サマリ

### 新規作成が必要なもの

1. **モード切替 UI（Header.tsx 改修 or 新規コンポーネント）**
   - `hasBothRoles` のとき「採用担当として見る」トグルまたはリンクが不在
   - YOUTRUST 型のように、ヘッダーにモード切替スイッチを追加する必要がある

2. **onboarding フロー（求職者側）**
   - `/auth/signup` 後のプロフィール初期設定ウィザード
   - 現状 `/onboarding` ページは存在するが（`src/app/onboarding/page.tsx`）詳細不明

3. **求職者側の会員専用ページ保護**
   - middleware の `needsAuth` 条件が `/biz/**` と `/admin/**` のみ
   - `/profile/edit`, `/mypage` 等の求職者向け認証ガードは各ページで個別対応

### 既存を改修すればよいもの

1. **Header.tsx のモード切替**（`src/components/Header.tsx`）
   - `hasBothRoles` ケースに採用担当モードへのリンク/スイッチを追加
   - 企業ロールを持つユーザーには `/biz/dashboard` へのリンクを追加

2. **ロール追加フロー**（既存 API 活用）
   - `/api/roles` (POST) で候補者ロール付与が可能
   - `/api/biz/members/invite` + `/api/biz/members/accept` で企業ロール付与が可能

3. **getTenantContext の userName 取得**
   - 現状 `user.user_metadata.name` を参照。ow_users.name との二重経路問題あり（CLAUDE.md 記載）
   - Phase 2 で ow_users.name への統一が望ましい

### 注意事項・考慮点

1. **candidates ロールと company ロールの独立管理**
   - `candidate` → `ow_user_roles` テーブル
   - `company` → `ow_company_admins` テーブル（別管理）
   - 同一ユーザーが両方持てる設計は整っている（hasBothRoles ロジックが存在）

2. **ow_experiences テーブルは完全稼働中**
   - 企業詳細ページの現役社員/OB-OG セクションが ow_experiences を Supabase から参照済み
   - 求職者側の職歴入力 API も整備済み（/api/jobseeker/experiences）

3. **middleware の保護スコープ**
   - `/biz/**` と `/admin/**` のみ保護中
   - 求職者向け認証ページ（/mypage, /profile/edit 等）は保護されていない
   - Phase 2 でオンボーディングフローを追加する場合、middleware の拡張が必要な可能性あり

4. **企業担当者の複数社対応は実装済み**
   - `/biz/select-company` と `biz_current_company_id` cookie で企業切替が動作中
   - `/api/biz/switch-company` で切替 API も整備済み

5. **ow_experience_stories の存在**
   - `089_create_ow_experience_stories.sql` と `094_a3_story_sections.sql` で経験ストーリー機能が追加済み
   - `/api/jobseeker/experience-stories/**` の API ルート群も充実（16ルート以上）
   - YOUTRUST 型のプロフィール充実施策の一環として既に構築されている
