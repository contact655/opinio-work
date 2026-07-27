-- ============================================================================
-- 037: Fix ow_company_admins RLS infinite recursion
-- ============================================================================
-- Problem: Both ow_company_admins_member_read and ow_company_admins_admin_manage
--          policies self-reference ow_company_admins, causing infinite recursion.
-- Solution: Two SECURITY DEFINER functions with SET row_security = off
--           (same pattern as migrations 035 + 036).
-- Side effect: Indirectly fixes recursive references from ow_jobs and
--              ow_company_office_photos policies that subquery ow_company_admins.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Part 1: auth_is_company_member — active member check
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_is_company_member(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ow_company_admins ca
    JOIN public.ow_users u ON u.id = ca.user_id
    WHERE ca.company_id = target_company_id
      AND u.auth_id = auth.uid()
      AND ca.is_active = true
  );
$$;

ALTER FUNCTION public.auth_is_company_member(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.auth_is_company_member(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- Part 2: auth_is_company_admin — admin-permission check
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_is_company_admin(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ow_company_admins ca
    JOIN public.ow_users u ON u.id = ca.user_id
    WHERE ca.company_id = target_company_id
      AND u.auth_id = auth.uid()
      AND ca.permission = 'admin'
      AND ca.is_active = true
  );
$$;

ALTER FUNCTION public.auth_is_company_admin(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.auth_is_company_admin(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- Part 3: Replace recursive policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "ow_company_admins_member_read" ON public.ow_company_admins;
CREATE POLICY "ow_company_admins_member_read"
  ON public.ow_company_admins
  FOR SELECT
  USING (auth_is_company_member(company_id));

DROP POLICY IF EXISTS "ow_company_admins_admin_manage" ON public.ow_company_admins;
CREATE POLICY "ow_company_admins_admin_manage"
  ON public.ow_company_admins
  FOR ALL
  USING (auth_is_company_admin(company_id))
  WITH CHECK (auth_is_company_admin(company_id));
