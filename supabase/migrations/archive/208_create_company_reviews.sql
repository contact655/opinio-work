-- 企業口コミ・評価テーブル
CREATE TABLE IF NOT EXISTS ow_company_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  employment_status TEXT NOT NULL CHECK (employment_status IN ('current', 'alumni')),
  rating_overall SMALLINT NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_culture SMALLINT CHECK (rating_culture BETWEEN 1 AND 5),
  rating_growth SMALLINT CHECK (rating_growth BETWEEN 1 AND 5),
  rating_wlb SMALLINT CHECK (rating_wlb BETWEEN 1 AND 5),
  rating_compensation SMALLINT CHECK (rating_compensation BETWEEN 1 AND 5),
  pros TEXT,
  cons TEXT,
  job_type TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, user_id)
);

ALTER TABLE ow_company_reviews ENABLE ROW LEVEL SECURITY;

-- 承認済みレビューは誰でも読める
CREATE POLICY "public_read_approved" ON ow_company_reviews
  FOR SELECT USING (is_approved = TRUE);

-- 本人は自分のレビューを読める（未承認含む）
CREATE POLICY "owner_read_own" ON ow_company_reviews
  FOR SELECT USING (
    user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
  );

-- 認証ユーザーは自分のレビューを投稿できる
CREATE POLICY "owner_insert" ON ow_company_reviews
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
  );

-- 本人は削除できる
CREATE POLICY "owner_delete" ON ow_company_reviews
  FOR DELETE USING (
    user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
  );

-- admin は全操作可能
CREATE POLICY "admin_all" ON ow_company_reviews
  FOR ALL USING (auth_is_admin());
