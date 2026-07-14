-- Migration 225: Add salary transition columns to ow_placements
-- These fields support statistical analysis of compensation at placement time.

ALTER TABLE ow_placements
  ADD COLUMN IF NOT EXISTS previous_annual_salary  INTEGER,
  ADD COLUMN IF NOT EXISTS previous_role_id         UUID REFERENCES ow_roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_role_id          UUID REFERENCES ow_roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_industry        TEXT,
  ADD COLUMN IF NOT EXISTS years_of_experience      INTEGER,
  ADD COLUMN IF NOT EXISTS statistics_consent       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMPTZ DEFAULT NOW();

-- Admin-only RLS (no change to existing policy structure; ow_placements is admin-only)
-- Ensure updated_at is refreshed on update
CREATE OR REPLACE FUNCTION update_placements_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_placements_updated_at ON ow_placements;
CREATE TRIGGER set_placements_updated_at
  BEFORE UPDATE ON ow_placements
  FOR EACH ROW EXECUTE FUNCTION update_placements_updated_at();
