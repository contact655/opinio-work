-- ============================================================================
-- 040 ROLLBACK: Remove invite flow columns from ow_company_admins
-- ============================================================================

DROP INDEX IF EXISTS public.uniq_pending_invite;
DROP INDEX IF EXISTS public.uniq_invitation_token;

ALTER TABLE public.ow_company_admins
  DROP COLUMN IF EXISTS accepted_at,
  DROP COLUMN IF EXISTS invited_at,
  DROP COLUMN IF EXISTS invited_email,
  DROP COLUMN IF EXISTS invitation_token,
  DROP COLUMN IF EXISTS invited_by_user_id;
