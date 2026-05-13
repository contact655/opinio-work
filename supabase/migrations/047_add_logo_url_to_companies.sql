-- 047_add_logo_url_to_companies.sql
-- ow_companies に logo_url カラムを追加

ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS logo_url text;
