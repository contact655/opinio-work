-- Phase ζ-1.5: fit_positives → company_features リネーム
-- 中立的命名に変更。データ構造 (jsonb / string[]) は維持
ALTER TABLE ow_companies RENAME COLUMN fit_positives TO company_features;
