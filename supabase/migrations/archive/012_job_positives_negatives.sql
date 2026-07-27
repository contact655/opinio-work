-- Add positives/negatives columns to ow_jobs
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS positives text[];
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS negatives text[];
