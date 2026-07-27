-- ============================================================================
-- 040: Add invite flow columns to ow_company_admins
-- ============================================================================
-- Adds 5 columns + 2 partial unique indexes to support M-4 (invite flow
-- for unregistered users):
--   invited_by_user_id: who sent the invite (NULL = legacy/direct-add rows)
--   invitation_token:   secret UUID for accept-invite URL (NULL after acceptance)
--   invited_email:      destination email (needed when user_id IS NULL,
--                       since JOIN to ow_users is unavailable for pending rows)
--   invited_at:         when the invite was created (used for 7-day expiry check)
--   accepted_at:        when the invitee accepted (NULL = still pending)
--
-- All columns are nullable so existing rows are unaffected.
--
-- Index uniq_invitation_token: prevents token collision on active invites only.
--   NULL tokens (post-acceptance) are excluded — NULLS DISTINCT is PG default.
-- Index uniq_pending_invite: prevents duplicate pending invites for the same
--   (company_id, invited_email) pair. Lifted once user_id is filled (accepted).
-- ============================================================================

ALTER TABLE public.ow_company_admins
  ADD COLUMN IF NOT EXISTS invited_by_user_id UUID
    REFERENCES public.ow_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invitation_token   TEXT,
  ADD COLUMN IF NOT EXISTS invited_email      TEXT,
  ADD COLUMN IF NOT EXISTS invited_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at        TIMESTAMPTZ;

-- Active (non-NULL) tokens must be unique.
-- NULL tokens (cleared after acceptance) are excluded from this index.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_invitation_token
  ON public.ow_company_admins (invitation_token)
  WHERE invitation_token IS NOT NULL;

-- Prevent duplicate pending invites for the same company + email.
-- Applies only while user_id IS NULL (not yet accepted).
-- Once accepted (user_id filled), the row is excluded and re-invitation is allowed.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_invite
  ON public.ow_company_admins (company_id, invited_email)
  WHERE user_id IS NULL AND invited_email IS NOT NULL;
