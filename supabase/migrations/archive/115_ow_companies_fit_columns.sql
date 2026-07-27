-- Migration 115: fit_positives / fit_negatives を ow_companies に追加
-- 企業詳細ページの「こんな人に向いている」「注意点」セクション用
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS fit_positives JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fit_negatives JSONB DEFAULT NULL;

COMMENT ON COLUMN ow_companies.fit_positives IS '「こんな人に向いている」ポイントの配列 (string[])';
COMMENT ON COLUMN ow_companies.fit_negatives IS '「注意点・向いていないかも」ポイントの配列 (string[])';
