-- 給与報告テーブル（匿名・集計専用）
CREATE TABLE IF NOT EXISTS ow_salary_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES ow_users(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL,
  years_of_experience SMALLINT CHECK (years_of_experience BETWEEN 0 AND 50),
  annual_salary INTEGER NOT NULL CHECK (annual_salary BETWEEN 2000000 AND 100000000),
  employment_status TEXT NOT NULL CHECK (employment_status IN ('current', 'alumni')),
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ow_salary_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_approved" ON ow_salary_reports;
DROP POLICY IF EXISTS "owner_read_own" ON ow_salary_reports;
DROP POLICY IF EXISTS "owner_insert" ON ow_salary_reports;
DROP POLICY IF EXISTS "admin_all" ON ow_salary_reports;

-- 承認済みは誰でも読める（集計用）
CREATE POLICY "public_read_approved" ON ow_salary_reports
  FOR SELECT USING (is_approved = TRUE);

-- 本人は自分のデータを読める
CREATE POLICY "owner_read_own" ON ow_salary_reports
  FOR SELECT USING (
    user_id IS NOT NULL AND
    user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
  );

-- 認証ユーザーは投稿できる
CREATE POLICY "owner_insert" ON ow_salary_reports
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
  );

-- admin は全操作可能
CREATE POLICY "admin_all" ON ow_salary_reports
  FOR ALL USING (auth_is_admin());
