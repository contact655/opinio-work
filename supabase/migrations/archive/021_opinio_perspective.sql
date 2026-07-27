-- Fix 14: Add opinio_perspective JSONB column for specific agent-interviewed content
-- Structure: { "fit_positives": ["..."], "fit_negatives": ["..."], "source": "Opinioエージェント取材（2026年4月）" }
ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS opinio_perspective jsonb;

-- Also add vision/value columns for Fix 9 (mission already exists)
ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS vision text;

ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS value text;
