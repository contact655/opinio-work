-- ===========================================================
-- Opinio Phase 1: Core Schema (仕様書準拠)
-- Created: 2026-04-23
--
-- 既存テーブルとの整合性方針:
--   - 既存 ow_profiles / ow_company_members / ow_threads 等は温存
--   - 仕様書で定義された新概念テーブルを新規作成
--   - ow_companies / ow_jobs への不足カラムを追加
--   - IF NOT EXISTS / ADD COLUMN IF NOT EXISTS で冪等性を担保
--
-- 作成対象:
--   A. ow_users           - 全ユーザー統合テーブル（求職者・メンター・企業担当者）
--   B. ow_roles           - 職種マスタ（2階層）+ 初期データ
--   C. ow_experiences     - 職歴（会社名3パターン対応）
--   D. ow_company_admins  - 企業担当者役割（ow_company_members とは別概念）
--   E. ow_company_office_photos - オフィス写真（カテゴリあり）
--   F. ow_company_perspectives  - Opinio見解（編集部執筆）
--   G. ow_job_assignees   - 求人担当者
--   H. ow_casual_meetings - カジュアル面談申込
--   I. ow_mentor_reservations   - メンター相談予約
--   J. ow_bookmarks       - 統合ブックマーク
--   K. ow_matches         - マッチング（企業側可視化用）
--   L. ow_activities      - アクティビティログ（ダッシュボード用）
--   M. ow_companies への不足カラム追加
--   N. ow_jobs への不足カラム追加
-- ===========================================================


-- ═══════════════════════════════════════════════════════════
-- A. ow_users（全ユーザー統合テーブル）
-- ═══════════════════════════════════════════════════════════
-- 思想2: 求職者・メンター・企業担当者を同じテーブルで管理
-- 既存 ow_profiles は段階的に移行予定（Phase 2 以降）
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ow_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id         UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  avatar_color    TEXT,
  cover_color     TEXT,
  about_me        TEXT,
  age_range       TEXT,  -- '20代前半' / '20代後半' / '30代前半' など
  location        TEXT,
  social_links    JSONB, -- { twitter, linkedin, note, github, ... }

  -- メンターとしての役割（動的付与）
  is_mentor           BOOLEAN NOT NULL DEFAULT false,
  mentor_registered_at TIMESTAMPTZ,
  mentor_themes       TEXT[],  -- 相談テーマ
  is_active_mentor    BOOLEAN NOT NULL DEFAULT false,

  -- プロフィール公開設定
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'login_only', 'private')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ow_users_auth_id
  ON ow_users(auth_id);
CREATE INDEX IF NOT EXISTS idx_ow_users_email
  ON ow_users(email);
CREATE INDEX IF NOT EXISTS idx_ow_users_is_mentor
  ON ow_users(is_mentor) WHERE is_mentor = true;

ALTER TABLE ow_users ENABLE ROW LEVEL SECURITY;

-- 公開プロフィールは誰でも閲覧可
DROP POLICY IF EXISTS "ow_users_public_read" ON ow_users;
CREATE POLICY "ow_users_public_read"
  ON ow_users FOR SELECT
  USING (visibility = 'public');

-- ログイン済みユーザーは login_only プロフィールも閲覧可
DROP POLICY IF EXISTS "ow_users_login_only_read" ON ow_users;
CREATE POLICY "ow_users_login_only_read"
  ON ow_users FOR SELECT
  USING (visibility = 'login_only' AND auth.uid() IS NOT NULL);

-- 本人は自分のプロフィールを常に閲覧可
DROP POLICY IF EXISTS "ow_users_own_read" ON ow_users;
CREATE POLICY "ow_users_own_read"
  ON ow_users FOR SELECT
  USING (auth_id = auth.uid());

-- 本人のみ自分のプロフィールを挿入・更新可
DROP POLICY IF EXISTS "ow_users_own_insert" ON ow_users;
CREATE POLICY "ow_users_own_insert"
  ON ow_users FOR INSERT
  WITH CHECK (auth_id = auth.uid());

DROP POLICY IF EXISTS "ow_users_own_update" ON ow_users;
CREATE POLICY "ow_users_own_update"
  ON ow_users FOR UPDATE
  USING (auth_id = auth.uid());


-- ═══════════════════════════════════════════════════════════
-- B. ow_roles（職種マスタ、2階層）
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ow_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id     UUID REFERENCES ow_roles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  icon_color    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- (name, parent_id) の組み合わせで一意（NULLS NOT DISTINCT は Postgres 15+ 必須）
  UNIQUE NULLS NOT DISTINCT (name, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_ow_roles_parent
  ON ow_roles(parent_id);

ALTER TABLE ow_roles ENABLE ROW LEVEL SECURITY;

-- 職種マスタは全ユーザー（未認証含む）読み取り可
DROP POLICY IF EXISTS "ow_roles_public_read" ON ow_roles;
CREATE POLICY "ow_roles_public_read"
  ON ow_roles FOR SELECT
  USING (true);

-- ── 初期データ（7大分類 + サブカテゴリ）──
-- 冪等対応: name + parent_id の組み合わせが存在しなければ挿入
DO $$
DECLARE
  r_sales    UUID;
  r_pdm      UUID;
  r_cs       UUID;
  r_eng      UUID;
  r_mktg     UUID;
  r_cxo      UUID;
  r_other    UUID;
BEGIN
  -- 大分類を INSERT（UNIQUE NULLS NOT DISTINCT により冪等）
  INSERT INTO ow_roles (name, display_order, icon_color)
  VALUES ('営業', 1, '#3B82F6')
  ON CONFLICT (name, parent_id) DO NOTHING;
  SELECT id INTO r_sales FROM ow_roles WHERE name = '営業' AND parent_id IS NULL LIMIT 1;

  INSERT INTO ow_roles (name, display_order, icon_color)
  VALUES ('PdM / PM', 2, '#8B5CF6')
  ON CONFLICT (name, parent_id) DO NOTHING;
  SELECT id INTO r_pdm FROM ow_roles WHERE name = 'PdM / PM' AND parent_id IS NULL LIMIT 1;

  INSERT INTO ow_roles (name, display_order, icon_color)
  VALUES ('カスタマーサクセス', 3, '#10B981')
  ON CONFLICT (name, parent_id) DO NOTHING;
  SELECT id INTO r_cs FROM ow_roles WHERE name = 'カスタマーサクセス' AND parent_id IS NULL LIMIT 1;

  INSERT INTO ow_roles (name, display_order, icon_color)
  VALUES ('エンジニア', 4, '#F59E0B')
  ON CONFLICT (name, parent_id) DO NOTHING;
  SELECT id INTO r_eng FROM ow_roles WHERE name = 'エンジニア' AND parent_id IS NULL LIMIT 1;

  INSERT INTO ow_roles (name, display_order, icon_color)
  VALUES ('マーケティング', 5, '#EC4899')
  ON CONFLICT (name, parent_id) DO NOTHING;
  SELECT id INTO r_mktg FROM ow_roles WHERE name = 'マーケティング' AND parent_id IS NULL LIMIT 1;

  INSERT INTO ow_roles (name, display_order, icon_color)
  VALUES ('経営・CxO', 6, '#002366')
  ON CONFLICT (name, parent_id) DO NOTHING;
  SELECT id INTO r_cxo FROM ow_roles WHERE name = '経営・CxO' AND parent_id IS NULL LIMIT 1;

  INSERT INTO ow_roles (name, display_order, icon_color)
  VALUES ('その他', 7, '#64748B')
  ON CONFLICT (name, parent_id) DO NOTHING;
  SELECT id INTO r_other FROM ow_roles WHERE name = 'その他' AND parent_id IS NULL LIMIT 1;

  -- 営業サブカテゴリ
  IF r_sales IS NOT NULL THEN
    INSERT INTO ow_roles (parent_id, name, display_order)
    VALUES
      (r_sales, 'フィールドセールス', 1),
      (r_sales, 'エンタープライズ営業', 2),
      (r_sales, 'インサイドセールス', 3),
      (r_sales, 'SDR / BDR', 4)
    ON CONFLICT (name, parent_id) DO NOTHING;
  END IF;

  -- PdM/PMサブカテゴリ
  IF r_pdm IS NOT NULL THEN
    INSERT INTO ow_roles (parent_id, name, display_order)
    VALUES
      (r_pdm, 'プロダクトマネージャー', 1),
      (r_pdm, 'プロダクトオーナー', 2),
      (r_pdm, 'PMM', 3)
    ON CONFLICT (name, parent_id) DO NOTHING;
  END IF;

  -- エンジニアサブカテゴリ
  IF r_eng IS NOT NULL THEN
    INSERT INTO ow_roles (parent_id, name, display_order)
    VALUES
      (r_eng, 'バックエンド', 1),
      (r_eng, 'フロントエンド', 2),
      (r_eng, 'フルスタック', 3),
      (r_eng, 'SRE / インフラ', 4),
      (r_eng, 'iOS / Android', 5)
    ON CONFLICT (name, parent_id) DO NOTHING;
  END IF;

  -- 経営・CxOサブカテゴリ
  IF r_cxo IS NOT NULL THEN
    INSERT INTO ow_roles (parent_id, name, display_order)
    VALUES
      (r_cxo, 'CEO', 1),
      (r_cxo, 'COO', 2),
      (r_cxo, 'CPO', 3),
      (r_cxo, 'CTO', 4),
      (r_cxo, 'CFO', 5)
    ON CONFLICT (name, parent_id) DO NOTHING;
  END IF;

  -- その他サブカテゴリ
  IF r_other IS NOT NULL THEN
    INSERT INTO ow_roles (parent_id, name, display_order)
    VALUES
      (r_other, 'デザイナー', 1),
      (r_other, '事業開発', 2),
      (r_other, 'HRBP', 3),
      (r_other, 'コーポレート', 4),
      (r_other, 'データサイエンティスト', 5)
    ON CONFLICT (name, parent_id) DO NOTHING;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
-- C. ow_experiences（職歴、会社名3パターン対応）
-- ═══════════════════════════════════════════════════════════
-- 会社名パターン:
--   1. company_id     → マスタ登録済み企業を参照
--   2. company_text   → マスタ未登録の自由入力
--   3. company_anonymized → 匿名表示用の名前（例: AIスタートアップA社）
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ow_experiences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,

  -- 会社（3パターン、どれか1つだけ入る）
  company_id          UUID REFERENCES ow_companies(id) ON DELETE SET NULL,
  company_text        TEXT,
  company_anonymized  TEXT,

  -- 職種
  role_category_id    UUID NOT NULL REFERENCES ow_roles(id),
  role_title          TEXT,  -- 具体的な役職名（自由入力、任意）

  -- 期間
  started_at          DATE NOT NULL,
  ended_at            DATE,
  is_current          BOOLEAN NOT NULL DEFAULT false,

  description         TEXT,
  display_order       INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 3パターンのうち必ず1つは入ること
  CONSTRAINT experience_company_xor CHECK (
    (company_id IS NOT NULL)::int +
    (company_text IS NOT NULL)::int +
    (company_anonymized IS NOT NULL)::int = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_ow_experiences_user
  ON ow_experiences(user_id);
CREATE INDEX IF NOT EXISTS idx_ow_experiences_company
  ON ow_experiences(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ow_experiences_role
  ON ow_experiences(role_category_id);
CREATE INDEX IF NOT EXISTS idx_ow_experiences_current
  ON ow_experiences(user_id, is_current) WHERE is_current = true;

ALTER TABLE ow_experiences ENABLE ROW LEVEL SECURITY;

-- 公開ユーザーの職歴は誰でも閲覧可
DROP POLICY IF EXISTS "ow_experiences_public_read" ON ow_experiences;
CREATE POLICY "ow_experiences_public_read"
  ON ow_experiences FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM ow_users WHERE visibility = 'public'
    )
  );

-- ログイン済みは login_only ユーザーの職歴も閲覧可
DROP POLICY IF EXISTS "ow_experiences_login_only_read" ON ow_experiences;
CREATE POLICY "ow_experiences_login_only_read"
  ON ow_experiences FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    user_id IN (
      SELECT id FROM ow_users WHERE visibility IN ('public', 'login_only')
    )
  );

-- 本人のみ自分の職歴を管理可
DROP POLICY IF EXISTS "ow_experiences_own_manage" ON ow_experiences;
CREATE POLICY "ow_experiences_own_manage"
  ON ow_experiences FOR ALL
  USING (
    user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════
-- D. ow_company_admins（企業担当者の役割）
-- ═══════════════════════════════════════════════════════════
-- ow_company_members（表示用メンバー情報）とは別概念。
-- こちらは「ログインして企業情報を管理できる人」の権限テーブル。
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ow_company_admins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  department  TEXT,
  role_title  TEXT,
  permission  TEXT NOT NULL DEFAULT 'member'
    CHECK (permission IN ('admin', 'member')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_ow_company_admins_company
  ON ow_company_admins(company_id);
CREATE INDEX IF NOT EXISTS idx_ow_company_admins_user
  ON ow_company_admins(user_id);

ALTER TABLE ow_company_admins ENABLE ROW LEVEL SECURITY;

-- 企業担当者は自社の管理者一覧を閲覧可
DROP POLICY IF EXISTS "ow_company_admins_member_read" ON ow_company_admins;
CREATE POLICY "ow_company_admins_member_read"
  ON ow_company_admins FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM ow_company_admins
      WHERE user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
        AND is_active = true
    )
  );

-- admin 権限を持つ担当者のみ管理可
DROP POLICY IF EXISTS "ow_company_admins_admin_manage" ON ow_company_admins;
CREATE POLICY "ow_company_admins_admin_manage"
  ON ow_company_admins FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM ow_company_admins
      WHERE user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
        AND permission = 'admin'
        AND is_active = true
    )
  );


-- ═══════════════════════════════════════════════════════════
-- E. ow_company_office_photos（オフィス写真、カテゴリあり）
-- ═══════════════════════════════════════════════════════════
-- 既存 ow_company_photos とは別テーブル（カテゴリ・上限管理が異なる）
-- カテゴリ: work(仕事風景) / meeting(会議) / welfare(福利厚生) / event(イベント)
-- 各カテゴリ最大5枚
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ow_company_office_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  category      TEXT NOT NULL
    CHECK (category IN ('work', 'meeting', 'welfare', 'event')),
  image_url     TEXT NOT NULL,
  caption       TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ow_company_office_photos_company
  ON ow_company_office_photos(company_id, category, display_order);

ALTER TABLE ow_company_office_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ow_company_office_photos_public_read" ON ow_company_office_photos;
CREATE POLICY "ow_company_office_photos_public_read"
  ON ow_company_office_photos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "ow_company_office_photos_admin_manage" ON ow_company_office_photos;
CREATE POLICY "ow_company_office_photos_admin_manage"
  ON ow_company_office_photos FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM ow_company_admins
      WHERE user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
        AND is_active = true
    )
  );


-- ═══════════════════════════════════════════════════════════
-- F. ow_company_perspectives（Opinio見解、編集部執筆）
-- ═══════════════════════════════════════════════════════════
-- 既存 ow_companies.opinio_perspective (JSONB) とは別の正規化テーブル。
-- 編集部が取材して執筆するコンテンツ。企業は編集不可。
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ow_company_perspectives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  author        TEXT,          -- Opinio編集部の執筆者名
  title         TEXT,
  body_markdown TEXT,
  is_featured   BOOLEAN NOT NULL DEFAULT false,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ow_company_perspectives_company
  ON ow_company_perspectives(company_id);

ALTER TABLE ow_company_perspectives ENABLE ROW LEVEL SECURITY;

-- 公開済みは誰でも閲覧可
DROP POLICY IF EXISTS "ow_company_perspectives_public_read" ON ow_company_perspectives;
CREATE POLICY "ow_company_perspectives_public_read"
  ON ow_company_perspectives FOR SELECT
  USING (published_at IS NOT NULL AND published_at <= NOW());

-- 運営のみ編集可（サービスロール使用、RLSではブロックしない）


-- ═══════════════════════════════════════════════════════════
-- G. ow_job_assignees（求人担当者）
-- ═══════════════════════════════════════════════════════════
-- 既存 ow_job_members とは別テーブル（ow_users を参照）
-- 求人詳細ページで担当者のキャリアを表示するための中間テーブル
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ow_job_assignees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES ow_jobs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ow_job_assignees_job
  ON ow_job_assignees(job_id);
CREATE INDEX IF NOT EXISTS idx_ow_job_assignees_user
  ON ow_job_assignees(user_id);

ALTER TABLE ow_job_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ow_job_assignees_public_read" ON ow_job_assignees;
CREATE POLICY "ow_job_assignees_public_read"
  ON ow_job_assignees FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "ow_job_assignees_admin_manage" ON ow_job_assignees;
CREATE POLICY "ow_job_assignees_admin_manage"
  ON ow_job_assignees FOR ALL
  USING (
    job_id IN (
      SELECT j.id FROM ow_jobs j
      JOIN ow_company_admins ca ON ca.company_id = j.company_id
      WHERE ca.user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
        AND ca.is_active = true
    )
  );


-- ═══════════════════════════════════════════════════════════
-- H. ow_casual_meetings（カジュアル面談申込）
-- ═══════════════════════════════════════════════════════════
-- 既存 ow_threads は「カジュアル面談メッセージスレッド」として
-- 引き続き使用。こちらは「申込フォームの提出データ」。
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ow_casual_meetings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,   -- 候補者
  company_id  UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  job_id      UUID REFERENCES ow_jobs(id) ON DELETE SET NULL,            -- 求人発の場合

  -- 申込フォーム
  share_profile   BOOLEAN NOT NULL DEFAULT true,
  intent          TEXT CHECK (intent IN (
    'info_gathering', 'good_opportunity', 'within_6', 'within_3'
  )),
  interest_reason TEXT,
  questions       TEXT,
  contact_email   TEXT NOT NULL,
  preferred_format TEXT,  -- 'zoom' / 'meet' / 'any'

  -- ステータス管理
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'company_contacted', 'scheduled', 'completed', 'declined'
    )),

  -- 企業側
  assignee_user_id    UUID REFERENCES ow_users(id) ON DELETE SET NULL,
  company_internal_memo TEXT,
  company_read_at     TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ow_casual_meetings_user
  ON ow_casual_meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_ow_casual_meetings_company
  ON ow_casual_meetings(company_id, status);
CREATE INDEX IF NOT EXISTS idx_ow_casual_meetings_job
  ON ow_casual_meetings(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ow_casual_meetings_created
  ON ow_casual_meetings(created_at DESC);

ALTER TABLE ow_casual_meetings ENABLE ROW LEVEL SECURITY;

-- 申込者は自分の申込を閲覧可
DROP POLICY IF EXISTS "ow_casual_meetings_seeker_read" ON ow_casual_meetings;
CREATE POLICY "ow_casual_meetings_seeker_read"
  ON ow_casual_meetings FOR SELECT
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

-- 申込者のみ申込を作成可（在籍企業チェックはアプリ層で実施）
DROP POLICY IF EXISTS "ow_casual_meetings_seeker_insert" ON ow_casual_meetings;
CREATE POLICY "ow_casual_meetings_seeker_insert"
  ON ow_casual_meetings FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

-- 企業担当者は自社への申込を閲覧・更新可
DROP POLICY IF EXISTS "ow_casual_meetings_company_read" ON ow_casual_meetings;
CREATE POLICY "ow_casual_meetings_company_read"
  ON ow_casual_meetings FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM ow_company_admins
      WHERE user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "ow_casual_meetings_company_update" ON ow_casual_meetings;
CREATE POLICY "ow_casual_meetings_company_update"
  ON ow_casual_meetings FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM ow_company_admins
      WHERE user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
        AND is_active = true
    )
  );


-- ═══════════════════════════════════════════════════════════
-- I. ow_mentor_reservations（メンター相談予約）
-- ═══════════════════════════════════════════════════════════
-- 既存 ow_consultation_bookings はフロー型（availability_id を前提）。
-- こちらは仕様書準拠の「申込フォーム → 編集部精査 → 調整」型。
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ow_mentor_reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,  -- 相談者
  mentor_user_id  UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,

  -- 申込内容
  themes          TEXT[],  -- 選択された相談テーマ
  current_situation TEXT,
  questions       TEXT,
  background      TEXT,

  -- 日程希望
  preferred_days  TEXT[],
  preferred_times TEXT[],
  contact_email   TEXT NOT NULL,
  preferred_platform TEXT,  -- 'zoom' / 'meet' / 'phone'

  -- ステータス
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN (
      'pending_review', 'approved', 'rejected',
      'scheduled', 'completed', 'cancelled'
    )),

  -- 編集部・メンター用内部メモ
  editor_note  TEXT,   -- 編集部の非公開メモ
  mentor_note  TEXT,   -- メンターの非公開メモ
  scheduled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ow_mentor_reservations_user
  ON ow_mentor_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_ow_mentor_reservations_mentor
  ON ow_mentor_reservations(mentor_user_id, status);
CREATE INDEX IF NOT EXISTS idx_ow_mentor_reservations_status
  ON ow_mentor_reservations(status);

ALTER TABLE ow_mentor_reservations ENABLE ROW LEVEL SECURITY;

-- 相談者は自分の予約を閲覧可
DROP POLICY IF EXISTS "ow_mentor_reservations_seeker_read" ON ow_mentor_reservations;
CREATE POLICY "ow_mentor_reservations_seeker_read"
  ON ow_mentor_reservations FOR SELECT
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

-- 相談者が申込を作成
DROP POLICY IF EXISTS "ow_mentor_reservations_seeker_insert" ON ow_mentor_reservations;
CREATE POLICY "ow_mentor_reservations_seeker_insert"
  ON ow_mentor_reservations FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

-- メンター本人は自分宛の予約を閲覧可
DROP POLICY IF EXISTS "ow_mentor_reservations_mentor_read" ON ow_mentor_reservations;
CREATE POLICY "ow_mentor_reservations_mentor_read"
  ON ow_mentor_reservations FOR SELECT
  USING (mentor_user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));


-- ═══════════════════════════════════════════════════════════
-- J. ow_bookmarks（統合ブックマーク）
-- ═══════════════════════════════════════════════════════════
-- 既存 ow_saved_companies / ow_saved_jobs / ow_job_favorites を
-- 将来的に統合するための新テーブル。並行稼動。
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ow_bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL
    CHECK (target_type IN ('article', 'company', 'job', 'mentor')),
  target_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_ow_bookmarks_user
  ON ow_bookmarks(user_id, target_type);

ALTER TABLE ow_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ow_bookmarks_own" ON ow_bookmarks;
CREATE POLICY "ow_bookmarks_own"
  ON ow_bookmarks FOR ALL
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));


-- ═══════════════════════════════════════════════════════════
-- K. ow_matches（マッチング、企業側可視化用）
-- ═══════════════════════════════════════════════════════════
-- 既存 ow_match_scores とは用途が異なる。
-- こちらは企業側ダッシュボードで「マッチ候補者」を表示するためのもの。
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ow_matches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  company_id         UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  job_id             UUID REFERENCES ow_jobs(id) ON DELETE SET NULL,
  match_score        FLOAT,
  match_reasons      TEXT[],
  viewed_by_company  BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ow_matches_company
  ON ow_matches(company_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_ow_matches_user
  ON ow_matches(user_id);

ALTER TABLE ow_matches ENABLE ROW LEVEL SECURITY;

-- 企業担当者は自社のマッチを閲覧可
DROP POLICY IF EXISTS "ow_matches_company_read" ON ow_matches;
CREATE POLICY "ow_matches_company_read"
  ON ow_matches FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM ow_company_admins
      WHERE user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "ow_matches_company_update" ON ow_matches;
CREATE POLICY "ow_matches_company_update"
  ON ow_matches FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM ow_company_admins
      WHERE user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
        AND is_active = true
    )
  );


-- ═══════════════════════════════════════════════════════════
-- L. ow_activities（アクティビティログ、ダッシュボード用）
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ow_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES ow_users(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,  -- 'casual_meeting_applied' / 'job_published' / 'mentor_reserved' / ...
  description   TEXT,
  target_type   TEXT,  -- 'casual_meeting' / 'job' / 'mentor_reservation' / ...
  target_id     UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ow_activities_company
  ON ow_activities(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ow_activities_type
  ON ow_activities(type);

ALTER TABLE ow_activities ENABLE ROW LEVEL SECURITY;

-- 企業担当者は自社のアクティビティを閲覧可
DROP POLICY IF EXISTS "ow_activities_company_read" ON ow_activities;
CREATE POLICY "ow_activities_company_read"
  ON ow_activities FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM ow_company_admins
      WHERE user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
        AND is_active = true
    )
  );


-- ═══════════════════════════════════════════════════════════
-- M. ow_companies への不足カラム追加
-- ═══════════════════════════════════════════════════════════

-- 基本情報
-- （website_url は migration 018 で追加済み・同型のため省略）
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS logo_letter      TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS logo_gradient    TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS about_markdown   TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS business_stage   TEXT;

-- 詳細情報
-- （avg_age は migration 006 で INTEGER として追加済みのため省略。アプリ層で数値として扱う）
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS established_at   TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS gender_ratio     TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS evaluation_system TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS benefits         TEXT[];

-- 働き方
-- （paid_leave_rate は migration 004 で INTEGER として追加済みのため省略。アプリ層で数値として扱う）
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS headquarters_address TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS nearest_station     TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS remote_work_status  TEXT
  CHECK (remote_work_status IS NULL OR remote_work_status IN ('full_remote', 'hybrid', 'on_site'));
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS work_time_system    TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS avg_overtime_hours  TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS workstyle_description TEXT;

-- 公開設定
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS is_published          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS accepting_casual_meetings BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS notification_emails   TEXT[];

-- 下書き機能
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS draft_data    JSONB;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS published_at  TIMESTAMPTZ;

-- 既存 ow_companies の RLS を is_published 対応に更新
-- (既存ポリシー "ow_companies_public_read" は status = 'active' を使用)
-- 新しいポリシーを追加（is_published = true も公開条件に含める）
DROP POLICY IF EXISTS "ow_companies_published_read" ON ow_companies;
CREATE POLICY "ow_companies_published_read"
  ON ow_companies FOR SELECT
  USING (is_published = true OR status = 'active');


-- ═══════════════════════════════════════════════════════════
-- N. ow_jobs への不足カラム追加
-- ═══════════════════════════════════════════════════════════

-- 職種マスタ参照
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS role_category_id UUID REFERENCES ow_roles(id);
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS department TEXT;

-- 給与・労働条件
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS salary_note     TEXT;
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS remote_work_status TEXT
  CHECK (remote_work_status IS NULL OR remote_work_status IN ('full_remote', 'hybrid', 'on_site'));
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS probation_period TEXT;

-- 仕事内容
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS description_markdown TEXT;
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS message_to_candidates TEXT;

-- 求める人物像
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS required_skills  TEXT[];
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS preferred_skills TEXT[];
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS culture_fit      TEXT;

-- 選考プロセス
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS selection_steps    TEXT[];
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS selection_duration TEXT;
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS start_date_preference TEXT;

-- 審査ワークフロー
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS rejection_reason   TEXT;
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS rejection_date     TIMESTAMPTZ;
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS rejection_reviewer TEXT;
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS submitted_at       TIMESTAMPTZ;
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS published_at       TIMESTAMPTZ;

-- status の CHECK 制約更新（既存: 'draft' / 'active' のみ想定）
-- 新規ステータスを追加: pending_review / published / rejected / private
-- CHECK 制約は後付けでは既存データと衝突する可能性があるため、
-- アプリ層でのバリデーションで対応（SQL レベルの追加は行わない）

-- ow_jobs の公開ポリシーを published ステータスにも対応
DROP POLICY IF EXISTS "ow_jobs_published_read" ON ow_jobs;
CREATE POLICY "ow_jobs_published_read"
  ON ow_jobs FOR SELECT
  USING (status IN ('active', 'published'));

-- role_category_id のインデックス
CREATE INDEX IF NOT EXISTS idx_ow_jobs_role_category
  ON ow_jobs(role_category_id) WHERE role_category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ow_jobs_status
  ON ow_jobs(status);


-- ═══════════════════════════════════════════════════════════
-- 完了
-- ═══════════════════════════════════════════════════════════
