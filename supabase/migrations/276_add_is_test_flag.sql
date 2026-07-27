-- Add is_test flag to ow_users for unified test account exclusion.
-- Replaces the scattered email pattern checks (NOT ILIKE '%@seed.internal')
-- that were missing contact+NN@opinio.co.jp accounts.
-- DEFAULT false means new accounts are real by default.
-- UPDATE to mark existing test accounts is a separate step requiring approval.
ALTER TABLE ow_users
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
