-- ───────────────────────────────────────────────────
-- Fix 9: Add values column (vision already exists from 021)
-- value → values (rename or alias)
-- ───────────────────────────────────────────────────
ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS values text;

-- Backfill values from value if value has data
UPDATE ow_companies
SET values = value
WHERE values IS NULL AND value IS NOT NULL;

-- ───────────────────────────────────────────────────
-- Fix 14: Structured Opinio perspective (title + detail per item)
-- ───────────────────────────────────────────────────
ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS opinio_fit_points jsonb;

ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS opinio_caution_points jsonb;

ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS opinio_source text;

ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS opinio_updated_at timestamptz;

-- Example:
-- UPDATE ow_companies SET
--   opinio_fit_points = '[
--     {"title":"論理的に数字で語れる営業が活躍","detail":"Opinio経由で入社した3名の共通点：前職で数字KPIをしっかり達成してきた経験"}
--   ]'::jsonb,
--   opinio_caution_points = '[
--     {"title":"プロダクト成熟期の新規開拓は難易度高","detail":"競合との差別化説明に工夫が必要"}
--   ]'::jsonb,
--   opinio_source = 'Opinioエージェント取材・選考データ分析',
--   opinio_updated_at = now()
-- WHERE id = '...';
