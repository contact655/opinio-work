-- migration 045: ow_mentor_reservations — add mentor_id FK + make mentor_user_id nullable
--
-- Background: mentors table (migration 008) has no user_id → ow_users link.
-- mentor_user_id was NOT NULL FK → ow_users.id, which made INSERT impossible
-- until the two tables are unified. Fix: add mentor_id FK → mentors.id and
-- relax mentor_user_id to nullable. mentor_user_id will be populated when the
-- mentors ↔ ow_users unification is done (M-5 candidate).

ALTER TABLE ow_mentor_reservations
  ADD COLUMN IF NOT EXISTS mentor_id UUID REFERENCES mentors(id) ON DELETE CASCADE;

ALTER TABLE ow_mentor_reservations
  ALTER COLUMN mentor_user_id DROP NOT NULL;

-- Index for the new FK
CREATE INDEX IF NOT EXISTS idx_ow_mentor_reservations_mentor_id
  ON ow_mentor_reservations(mentor_id);
