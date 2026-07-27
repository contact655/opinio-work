-- Migration 208b: ow_company_reviews を新スキーマにアップグレード
-- 旧テーブルには content / role / rating カラムのみ存在
-- 新コード（api/company-reviews, admin/reviews）が期待するカラムを追加

ALTER TABLE ow_company_reviews
  ADD COLUMN IF NOT EXISTS employment_status TEXT CHECK (employment_status IN ('current', 'alumni')),
  ADD COLUMN IF NOT EXISTS rating_overall    SMALLINT CHECK (rating_overall    BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_culture    SMALLINT CHECK (rating_culture    BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_growth     SMALLINT CHECK (rating_growth     BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_wlb        SMALLINT CHECK (rating_wlb        BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_compensation SMALLINT CHECK (rating_compensation BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS pros      TEXT,
  ADD COLUMN IF NOT EXISTS cons      TEXT,
  ADD COLUMN IF NOT EXISTS job_type  TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- company_id + user_id の UNIQUE 制約（1社1レビュー）
ALTER TABLE ow_company_reviews
  DROP CONSTRAINT IF EXISTS ow_company_reviews_company_id_user_id_key;
ALTER TABLE ow_company_reviews
  ADD CONSTRAINT ow_company_reviews_company_user_unique UNIQUE (company_id, user_id);

-- RLS が無効なら有効化
ALTER TABLE ow_company_reviews ENABLE ROW LEVEL SECURITY;

-- 必要なポリシーを追加
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
