-- ============================================================================
-- 041: Allow user_id NULL in ow_company_admins for pending invites
-- ============================================================================
-- Fix: migration 040 added invite flow columns but forgot to drop the NOT NULL
-- constraint on user_id. Pending invite records (user not yet registered) must
-- be able to store user_id = NULL until the invitee accepts and creates an account.
-- ============================================================================

ALTER TABLE public.ow_company_admins
  ALTER COLUMN user_id DROP NOT NULL;
