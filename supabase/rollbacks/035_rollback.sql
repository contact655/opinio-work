-- 035 ロールバック SQL
DROP POLICY IF EXISTS "ow_user_roles_admin_read" ON public.ow_user_roles;
CREATE POLICY "ow_user_roles_admin_read" ON public.ow_user_roles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.ow_user_roles
            WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "ow_profiles_admin_read" ON public.ow_profiles;
CREATE POLICY "ow_profiles_admin_read" ON public.ow_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.ow_user_roles
            WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP FUNCTION IF EXISTS public.auth_is_admin();
