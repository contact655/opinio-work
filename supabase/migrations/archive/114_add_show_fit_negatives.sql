-- Migration 114: add show_fit_negatives column to ow_companies
-- Controls whether the "向いていない人" (not-suitable people) section is shown publicly
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS show_fit_negatives boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN ow_companies.show_fit_negatives IS
  'When false, fit_negatives data is collected but not shown on the public company page';
