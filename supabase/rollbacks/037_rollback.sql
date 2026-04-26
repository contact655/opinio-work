-- 037 ロールバック: ow_company_admins の policy と関数を 036 時点に戻す
DROP POLICY IF EXISTS "ow_company_admins_member_read" ON public.ow_company_admins;
CREATE POLICY "ow_company_admins_member_read" ON public.ow_company_admins
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.ow_company_admins
      WHERE user_id IN (SELECT id FROM public.ow_users WHERE auth_id = auth.uid())
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "ow_company_admins_admin_manage" ON public.ow_company_admins;
CREATE POLICY "ow_company_admins_admin_manage" ON public.ow_company_admins
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.ow_company_admins
      WHERE user_id IN (SELECT id FROM public.ow_users WHERE auth_id = auth.uid())
        AND permission = 'admin'
        AND is_active = true
    )
  );

DROP FUNCTION IF EXISTS public.auth_is_company_member(uuid);
DROP FUNCTION IF EXISTS public.auth_is_company_admin(uuid);
