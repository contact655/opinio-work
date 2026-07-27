-- ============================================================================
-- 039: Unify ow_activities RLS to use auth_is_company_member()
-- ============================================================================
-- Problem: The ow_activities_company_read policy in migration 031 uses a raw
--          subquery to ow_company_admins, bypassing the SECURITY DEFINER
--          optimization established in migration 037.
-- Solution: Replace with auth_is_company_member(company_id) function call.
--           Also add INSERT policy so API routes (authenticated) can log events.
-- ============================================================================

-- Update SELECT policy to use the centralized SECURITY DEFINER function
DROP POLICY IF EXISTS "ow_activities_company_read" ON public.ow_activities;
CREATE POLICY "ow_activities_company_read"
  ON public.ow_activities
  FOR SELECT
  USING (auth_is_company_member(company_id));

-- Allow company members to insert activity events via authenticated API routes
DROP POLICY IF EXISTS "ow_activities_company_insert" ON public.ow_activities;
CREATE POLICY "ow_activities_company_insert"
  ON public.ow_activities
  FOR INSERT
  WITH CHECK (auth_is_company_member(company_id));
