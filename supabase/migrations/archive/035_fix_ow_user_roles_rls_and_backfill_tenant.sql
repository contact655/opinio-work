-- ============================================================================
-- 035: Fix ow_user_roles RLS infinite recursion + backfill tenant_id
-- ============================================================================
-- Problem 1: ow_user_roles_admin_read policy uses self-referencing EXISTS,
--            causing infinite recursion when querying ow_user_roles.
-- Problem 2: Existing company role users (registered before migration 028)
--            have tenant_id = NULL, breaking getTenantContext primary path.
-- Solution:
--   1. Replace recursive admin policies with SECURITY DEFINER function
--   2. Backfill tenant_id from ow_companies.user_id mapping
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Part 1: SECURITY DEFINER admin check function
-- ----------------------------------------------------------------------------
-- This function bypasses RLS when checking admin status, eliminating
-- the self-reference loop in ow_user_roles policies.
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Grant execute to authenticated users (function itself bypasses RLS internally)
GRANT EXECUTE ON FUNCTION public.auth_is_admin() TO authenticated;

-- ----------------------------------------------------------------------------
-- Part 2: Replace recursive policies on ow_user_roles
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "ow_user_roles_admin_read" ON public.ow_user_roles;

CREATE POLICY "ow_user_roles_admin_read"
ON public.ow_user_roles
FOR SELECT
USING (auth_is_admin());

-- ----------------------------------------------------------------------------
-- Part 3: Replace recursive policies on ow_profiles
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "ow_profiles_admin_read" ON public.ow_profiles;

CREATE POLICY "ow_profiles_admin_read"
ON public.ow_profiles
FOR SELECT
USING (auth_is_admin());

-- ----------------------------------------------------------------------------
-- Part 4: Backfill tenant_id for existing company role users
-- ----------------------------------------------------------------------------
-- For users with role='company' but tenant_id=NULL,
-- find their company by user_id and set tenant_id accordingly.
-- Idempotent: only updates rows where tenant_id IS NULL.
UPDATE public.ow_user_roles ur
SET tenant_id = c.id
FROM public.ow_companies c
WHERE ur.role = 'company'
  AND ur.tenant_id IS NULL
  AND c.user_id = ur.user_id;

-- Log how many rows were affected (visible in migration output)
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled tenant_id for % company role users', affected_count;
END $$;

-- ----------------------------------------------------------------------------
-- Part 5: Verification queries (commented; run manually if needed)
-- ----------------------------------------------------------------------------
-- SELECT COUNT(*) FROM ow_user_roles WHERE role = 'company' AND tenant_id IS NULL;
-- (expected: 0 after this migration, unless a company user has no ow_companies row)
