ALTER TABLE ow_jobs
  ADD COLUMN IF NOT EXISTS tech_stack text[] NOT NULL DEFAULT '{}';
