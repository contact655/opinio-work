-- =====================================================================
-- Migration 216 (完全版): ow_company_reviews テーブル作成 + 8軸評価
-- Migration 208 + 208b + 216 を統合。テーブルが存在しない場合のフルセットアップ。
-- =====================================================================

-- 1. テーブル作成（既に存在する場合はスキップ）
CREATE TABLE IF NOT EXISTS ow_company_reviews (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID        NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  employment_status   TEXT        CHECK (employment_status IN ('current', 'alumni')),
  rating_overall      SMALLINT    CHECK (rating_overall      BETWEEN 1 AND 5),
  rating_culture      SMALLINT    CHECK (rating_culture      BETWEEN 1 AND 5),
  rating_growth       SMALLINT    CHECK (rating_growth       BETWEEN 1 AND 5),
  rating_wlb          SMALLINT    CHECK (rating_wlb          BETWEEN 1 AND 5),
  rating_compensation SMALLINT    CHECK (rating_compensation BETWEEN 1 AND 5),
  rating_leadership   SMALLINT    CHECK (rating_leadership   BETWEEN 1 AND 5),
  rating_business     SMALLINT    CHECK (rating_business     BETWEEN 1 AND 5),
  rating_welfare      SMALLINT    CHECK (rating_welfare      BETWEEN 1 AND 5),
  pros        TEXT,
  cons        TEXT,
  job_type    TEXT,
  is_approved BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 既存テーブルへの追加カラム（IF NOT EXISTS で冪等）
ALTER TABLE ow_company_reviews
  ADD COLUMN IF NOT EXISTS rating_leadership   SMALLINT CHECK (rating_leadership   BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_business     SMALLINT CHECK (rating_business     BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_welfare      SMALLINT CHECK (rating_welfare      BETWEEN 1 AND 5);

COMMENT ON COLUMN ow_company_reviews.rating_leadership IS 'リーダーシップ：経営・マネジメントの質（1-5, nullable）';
COMMENT ON COLUMN ow_company_reviews.rating_business   IS 'ビジネス展望：将来性・成長性（1-5, nullable）';
COMMENT ON COLUMN ow_company_reviews.rating_welfare    IS '福利厚生：制度と実際の活用（1-5, nullable）';

-- 3. UNIQUE 制約（1社1ユーザー1レビュー）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ow_company_reviews_company_user_unique'
  ) THEN
    ALTER TABLE ow_company_reviews
      ADD CONSTRAINT ow_company_reviews_company_user_unique UNIQUE (company_id, user_id);
  END IF;
END $$;

-- 4. RLS
ALTER TABLE ow_company_reviews ENABLE ROW LEVEL SECURITY;

-- 5. ポリシー（存在しない場合のみ作成）
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_company_reviews' AND policyname='public_read_approved') THEN
    CREATE POLICY "public_read_approved" ON ow_company_reviews
      FOR SELECT USING (is_approved = TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_company_reviews' AND policyname='owner_read_own') THEN
    CREATE POLICY "owner_read_own" ON ow_company_reviews
      FOR SELECT USING (
        user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_company_reviews' AND policyname='owner_insert') THEN
    CREATE POLICY "owner_insert" ON ow_company_reviews
      FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_company_reviews' AND policyname='owner_delete') THEN
    CREATE POLICY "owner_delete" ON ow_company_reviews
      FOR DELETE USING (
        user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_company_reviews' AND policyname='admin_all') THEN
    CREATE POLICY "admin_all" ON ow_company_reviews
      FOR ALL USING (auth_is_admin());
  END IF;
END $$;
