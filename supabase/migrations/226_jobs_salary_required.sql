-- Migration 226: Make salary_min and salary_max required on ow_jobs
-- Existing NULL rows get 0 as placeholder; update them via admin before enforcing.

-- Backfill existing NULLs so the NOT NULL constraint can be applied
UPDATE ow_jobs SET salary_min = 0 WHERE salary_min IS NULL;
UPDATE ow_jobs SET salary_max = 0 WHERE salary_max IS NULL;

-- Enforce NOT NULL
ALTER TABLE ow_jobs
  ALTER COLUMN salary_min SET NOT NULL,
  ALTER COLUMN salary_max SET NOT NULL;

-- Ensure max >= min (allow equal to support single-point salaries)
ALTER TABLE ow_jobs
  ADD CONSTRAINT ow_jobs_salary_range_check CHECK (salary_max >= salary_min);
