-- ============================================================================
-- 038: Fix ow_company_office_photos category + WITH CHECK
-- ============================================================================
-- Problem 1: category CHECK uses 'work' but frontend uses 'workspace'.
--            Frontend's PhotoCategory type drives UI labels and gradients,
--            so updating the DB constraint is cleaner than client-side mapping.
-- Problem 2: admin_manage policy lacks WITH CHECK, leaving INSERT/UPDATE
--            theoretically open to inserting rows for other company_ids.
-- ============================================================================

-- Part 1: Rename existing 'work' rows (if any) to 'workspace'
UPDATE public.ow_company_office_photos
SET category = 'workspace'
WHERE category = 'work';

-- Part 2: Replace category CHECK constraint
ALTER TABLE public.ow_company_office_photos
  DROP CONSTRAINT IF EXISTS ow_company_office_photos_category_check;

ALTER TABLE public.ow_company_office_photos
  ADD CONSTRAINT ow_company_office_photos_category_check
  CHECK (category IN ('workspace', 'meeting', 'welfare', 'event'));

-- Part 3: Add WITH CHECK to admin_manage policy
DROP POLICY IF EXISTS "ow_company_office_photos_admin_manage"
  ON public.ow_company_office_photos;

CREATE POLICY "ow_company_office_photos_admin_manage"
  ON public.ow_company_office_photos
  FOR ALL
  USING (auth_is_company_admin(company_id))
  WITH CHECK (auth_is_company_admin(company_id));

-- Note: ow_company_office_photos_public_read (FOR SELECT USING true) is unchanged
