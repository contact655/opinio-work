-- migration 049: ow_job_applications に企業管理者用 RLS + status CHECK 制約
-- 目的: biz 側の /biz/applications ページで企業管理者が自社求人への応募を閲覧・管理できる
-- 背景: migration 016 では求職者側 (INSERT + 自分の SELECT) のみ定義されており、
--       企業管理者が自社求人への応募を読み書きできる policy が未存在だった。
--
-- Pre-check: SELECT DISTINCT status FROM ow_job_applications; → 0 行 (DB 空)
--            → CHECK 制約追加は安全
--
-- Rollback:
--   DROP POLICY IF EXISTS "company_admins_read_applications" ON ow_job_applications;
--   DROP POLICY IF EXISTS "company_admins_update_applications" ON ow_job_applications;
--   ALTER TABLE ow_job_applications DROP CONSTRAINT IF EXISTS ow_job_applications_status_check;

-- ─── 1. 企業管理者: 自社求人への応募を SELECT ───────────────────────
CREATE POLICY "company_admins_read_applications"
  ON ow_job_applications FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM ow_jobs
      WHERE company_id IN (
        SELECT company_id FROM ow_company_admins
        WHERE user_id IN (
          SELECT id FROM ow_users WHERE auth_id = auth.uid()
        )
        AND is_active = true
      )
    )
  );

-- ─── 2. 企業管理者: status 更新 (PATCH) ────────────────────────────
CREATE POLICY "company_admins_update_applications"
  ON ow_job_applications FOR UPDATE
  USING (
    job_id IN (
      SELECT id FROM ow_jobs
      WHERE company_id IN (
        SELECT company_id FROM ow_company_admins
        WHERE user_id IN (
          SELECT id FROM ow_users WHERE auth_id = auth.uid()
        )
        AND is_active = true
      )
    )
  )
  WITH CHECK (
    job_id IN (
      SELECT id FROM ow_jobs
      WHERE company_id IN (
        SELECT company_id FROM ow_company_admins
        WHERE user_id IN (
          SELECT id FROM ow_users WHERE auth_id = auth.uid()
        )
        AND is_active = true
      )
    )
  );

-- ─── 3. status CHECK 制約 (Defense in depth) ───────────────────────
-- 有効値: pending / reviewing / interview / accepted / rejected
ALTER TABLE ow_job_applications
  ADD CONSTRAINT ow_job_applications_status_check
  CHECK (status IN ('pending', 'reviewing', 'interview', 'accepted', 'rejected'));
