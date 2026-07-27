-- Migration 224: Drop 口コミ/給与 review tables (feature removed)
-- Backup: tables are dropped with data; restore from Supabase dashboard backups if needed.

DROP TABLE IF EXISTS ow_review_reports CASCADE;
DROP TABLE IF EXISTS ow_review_access CASCADE;
DROP TABLE IF EXISTS ow_salary_reports CASCADE;
DROP TABLE IF EXISTS ow_company_reviews CASCADE;

-- Remove review_gate_enabled from ow_settings (no longer needed)
DELETE FROM ow_settings WHERE key = 'review_gate_enabled';
