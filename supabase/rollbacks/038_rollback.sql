-- 038 ロールバック: ow_company_office_photos の category + policy を 031 時点に戻す
UPDATE public.ow_company_office_photos
SET category = 'work'
WHERE category = 'workspace';

ALTER TABLE public.ow_company_office_photos
  DROP CONSTRAINT IF EXISTS ow_company_office_photos_category_check;

ALTER TABLE public.ow_company_office_photos
  ADD CONSTRAINT ow_company_office_photos_category_check
  CHECK (category IN ('work', 'meeting', 'welfare', 'event'));

DROP POLICY IF EXISTS "ow_company_office_photos_admin_manage"
  ON public.ow_company_office_photos;

CREATE POLICY "ow_company_office_photos_admin_manage"
  ON public.ow_company_office_photos
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM ow_company_admins
      WHERE user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
        AND is_active = true
    )
  );
