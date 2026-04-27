-- ============================================================================
-- 041 ROLLBACK: Restore NOT NULL constraint on ow_company_admins.user_id
-- ============================================================================
-- WARNING: This will fail if any rows have user_id = NULL (pending invites).
-- Delete or resolve all pending invite records before running this rollback.

ALTER TABLE public.ow_company_admins
  ALTER COLUMN user_id SET NOT NULL;
