-- ============================================================================
-- 039 ROLLBACK: Restore ow_activities RLS to original subquery pattern
-- ============================================================================

-- Remove INSERT policy (added in 039)
DROP POLICY IF EXISTS "ow_activities_company_insert" ON public.ow_activities;

-- Restore original SELECT policy from migration 031
DROP POLICY IF EXISTS "ow_activities_company_read" ON public.ow_activities;
CREATE POLICY "ow_activities_company_read"
  ON public.ow_activities
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM ow_company_admins
      WHERE user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
        AND is_active = true
    )
  );
