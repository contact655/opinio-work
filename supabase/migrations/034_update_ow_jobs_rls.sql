-- supabase/migrations/034_update_ow_jobs_rls.sql
-- ============================================
-- Step 1: 既存 owner を ow_company_admins に追加
-- ============================================
INSERT INTO ow_company_admins (
  user_id,
  company_id,
  permission,
  is_active,
  department,
  role_title,
  created_at
)
SELECT
  u.id AS user_id,
  c.id AS company_id,
  'admin' AS permission,
  true AS is_active,
  NULL AS department,
  NULL AS role_title,
  NOW() AS created_at
FROM ow_companies c
JOIN ow_users u ON u.auth_id = c.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM ow_company_admins ca
  WHERE ca.user_id = u.id AND ca.company_id = c.id
)
AND c.user_id IS NOT NULL;

-- ============================================
-- Step 2: 旧 RLS ポリシー削除
-- ============================================
DROP POLICY IF EXISTS "ow_jobs_own_manage" ON ow_jobs;

-- ============================================
-- Step 3: 新 RLS ポリシー追加
-- ============================================
CREATE POLICY "ow_jobs_company_admin_manage"
  ON ow_jobs FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM ow_company_admins
      WHERE user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
        AND is_active = true
    )
  );

COMMENT ON POLICY "ow_jobs_company_admin_manage" ON ow_jobs IS
  'Company admins (incl. owners auto-migrated from owner-only policy)
   can manage jobs. Replaces ow_jobs_own_manage from migration 001.
   Owner records auto-migrated by Step 1 of this migration.';
