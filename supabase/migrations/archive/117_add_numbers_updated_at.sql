-- Add numbers_updated_at to track when company last answered numeric survey
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS numbers_updated_at timestamptz;

COMMENT ON COLUMN ow_companies.numbers_updated_at IS '数値アンケートの最終回答日時（企業側biz管理画面から更新）';
