-- ============================================================================
-- 036: Fix auth_is_admin() to bypass RLS internally
-- ============================================================================
-- Problem: PostgreSQL 15+ applies RLS even inside SECURITY DEFINER functions.
--          This causes infinite recursion when ow_user_roles_admin_read policy
--          calls auth_is_admin(), which itself queries ow_user_roles.
-- Solution: Add SET row_security = off to function definition, ensuring
--           queries inside the function bypass RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- 関数の所有者を postgres に明示（既に postgres でも冪等）
ALTER FUNCTION public.auth_is_admin() OWNER TO postgres;

-- 念のため EXECUTE 権限を再付与
GRANT EXECUTE ON FUNCTION public.auth_is_admin() TO authenticated;
