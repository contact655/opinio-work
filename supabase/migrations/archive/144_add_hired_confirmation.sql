-- Migration 144: 採用確定フィールドの追加（マネタイズ基盤）
-- 採用確定日時と採用時年収を記録し、成果報酬（年収10%）の請求根拠とする

ALTER TABLE ow_job_applications
  ADD COLUMN IF NOT EXISTS hired_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hired_salary INTEGER; -- 採用時年収（万円単位）
