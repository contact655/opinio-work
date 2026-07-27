-- Migration 242: ow_salary_reports に期間・グレード・OTE を追加
--
-- 変更内容:
--   1. カラム追加: start_year_month / end_year_month / grade / ote /
--                  achievement_rate / allowances / fixed_overtime
--   2. annual_salary を nullable に変更（OTE が主フィールドになるため）
--   3. 既存1件のデータ移行: annual_salary → ote にコピー
--   4. UNIQUE 制約は追加しない（案B）
--
-- 注意: start_year_month は DB 上は NULL 許容
--       フォームレベルでは必須とする

BEGIN;

-- 1. カラム追加
ALTER TABLE ow_salary_reports
  ADD COLUMN IF NOT EXISTS start_year_month  TEXT,
  ADD COLUMN IF NOT EXISTS end_year_month    TEXT,
  ADD COLUMN IF NOT EXISTS grade             TEXT,
  ADD COLUMN IF NOT EXISTS ote               INTEGER,
  ADD COLUMN IF NOT EXISTS achievement_rate  INTEGER,
  ADD COLUMN IF NOT EXISTS allowances        INTEGER,
  ADD COLUMN IF NOT EXISTS fixed_overtime    INTEGER;

-- 2. 書式チェック制約
ALTER TABLE ow_salary_reports
  ADD CONSTRAINT ow_salary_reports_start_ym_check
    CHECK (start_year_month IS NULL OR start_year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT ow_salary_reports_end_ym_check
    CHECK (end_year_month IS NULL OR end_year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT ow_salary_reports_achievement_rate_check
    CHECK (achievement_rate IS NULL OR (achievement_rate >= 0 AND achievement_rate <= 500)),
  ADD CONSTRAINT ow_salary_reports_ote_check
    CHECK (ote IS NULL OR (ote >= 1000000 AND ote <= 500000000));

-- 3. annual_salary を nullable に変更（OTE が主フィールドになるため）
ALTER TABLE ow_salary_reports
  ALTER COLUMN annual_salary DROP NOT NULL;

-- 4. 既存1件のデータ移行: annual_salary → ote にコピー
--    start_year_month は NULL のまま（管理者が /admin/salary-reports から入力）
UPDATE ow_salary_reports
  SET ote = annual_salary
  WHERE ote IS NULL AND annual_salary IS NOT NULL;

-- UNIQUE 制約は追加しない（案B: アプリ側で重複チェック）

COMMIT;
