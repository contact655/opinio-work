-- Migration 135: 企業掲載ステータス管理 (法的整理対応)
-- 「ディレクトリとして広く掲載、求人と課金は契約済みに絞る」設計原則に基づく

-- ── 1. ENUM 型の作成 ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE listing_status_enum AS ENUM ('draft', 'listed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE engagement_status_enum AS ENUM ('none', 'permitted', 'contracted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. ow_companies へのカラム追加 ────────────────────────────────────────────

ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS listing_status    listing_status_enum    NOT NULL DEFAULT 'listed',
  ADD COLUMN IF NOT EXISTS engagement_status engagement_status_enum NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS jobs_public       BOOLEAN                NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS permitted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contracted_at     TIMESTAMPTZ;

-- 既存企業の初期値設定:
--   - 全社: listing_status = 'listed'（事実情報として掲載済み）
--   - テスト段階で jobs_public = true にしていた企業 → そのまま
--     （accepting_casual_meetings = true の企業はテスト公開中とみなす）
UPDATE ow_companies
SET jobs_public = TRUE
WHERE accepting_casual_meetings = TRUE;

-- ── 3. ow_company_members テーブル（社員本人同意管理） ─────────────────────────

CREATE TABLE IF NOT EXISTS ow_company_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  display_consent BOOLEAN     NOT NULL DEFAULT FALSE,  -- 「この企業の社員として表示する」本人同意
  consent_at      TIMESTAMPTZ,                         -- 同意日時
  is_public       BOOLEAN     NOT NULL DEFAULT FALSE,  -- 実際に企業ページに表示するか
  role_title      TEXT,                                -- 表示する役職名（任意）
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- is_public は display_consent = true のときのみ許可 (CHECK 制約)
ALTER TABLE ow_company_members
  ADD CONSTRAINT check_public_requires_consent
  CHECK (is_public = FALSE OR display_consent = TRUE);

-- ── 4. インデックス ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ow_company_members_company ON ow_company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_ow_company_members_user    ON ow_company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_ow_companies_engagement    ON ow_companies(engagement_status);
CREATE INDEX IF NOT EXISTS idx_ow_companies_jobs_public   ON ow_companies(jobs_public);

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE ow_company_members ENABLE ROW LEVEL SECURITY;

-- 読み取り: is_public = true の行は誰でも読める（企業ページ表示用）
CREATE POLICY "public_members_read" ON ow_company_members
  FOR SELECT USING (is_public = TRUE);

-- 自分のレコードは本人が読める
CREATE POLICY "own_member_read" ON ow_company_members
  FOR SELECT USING (user_id = auth.uid());

-- 管理者は全件操作可
CREATE POLICY "admin_full_access_members" ON ow_company_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM ow_user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── 6. updated_at 自動更新トリガー ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_company_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_company_members_updated_at ON ow_company_members;
CREATE TRIGGER trg_company_members_updated_at
  BEFORE UPDATE ON ow_company_members
  FOR EACH ROW EXECUTE FUNCTION update_company_members_updated_at();

-- ── 7. コメント ───────────────────────────────────────────────────────────────

COMMENT ON COLUMN ow_companies.listing_status    IS '掲載状態: draft=非掲載, listed=事実情報として掲載';
COMMENT ON COLUMN ow_companies.engagement_status IS '企業との関係: none=未連絡, permitted=求人公開許可済, contracted=求人申込契約済';
COMMENT ON COLUMN ow_companies.jobs_public       IS '求人・面談OKを実際に表示するか（engagement_status が permitted/contracted のときのみ true 可）';
COMMENT ON COLUMN ow_companies.permitted_at      IS '求人公開許可取得日時';
COMMENT ON COLUMN ow_companies.contracted_at     IS '求人申込契約成立日時';
COMMENT ON TABLE  ow_company_members             IS '社員アカウントの企業紐づけと本人同意管理（ow_company_admins とは別：こちらは「所属表示」、admins は「管理権限」）';
