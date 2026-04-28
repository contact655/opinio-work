-- ============================================================
-- 042 ROLLBACK: Remove multitenant columns from ow_company_admins
-- ============================================================

DROP INDEX IF EXISTS public.uniq_default_company_per_user;

ALTER TABLE public.ow_company_admins
  DROP COLUMN IF EXISTS is_default,
  DROP COLUMN IF EXISTS joined_at;
