-- Migration 147: Add enriched job detail fields
ALTER TABLE ow_jobs
  ADD COLUMN IF NOT EXISTS why_hire TEXT,
  ADD COLUMN IF NOT EXISTS team_composition TEXT,
  ADD COLUMN IF NOT EXISTS first_90_days TEXT;

COMMENT ON COLUMN ow_jobs.why_hire IS 'なぜ今採用するか：ビジネス背景・チームの課題';
COMMENT ON COLUMN ow_jobs.team_composition IS 'チーム構成：人数・職種・雰囲気など';
COMMENT ON COLUMN ow_jobs.first_90_days IS '入社後90日でやること：最初のミッション';
