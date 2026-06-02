-- Migration 129: Add employment_type to ow_experiences
-- 職歴エントリに雇用形態を追加（正社員 / 業務委託 / インターン / 役員 / 嘱託 / アルバイト）

ALTER TABLE ow_experiences
  ADD COLUMN IF NOT EXISTS employment_type TEXT;

COMMENT ON COLUMN ow_experiences.employment_type IS '雇用形態（正社員 / 業務委託 / インターン / 役員 / 嘱託 / アルバイト）';
