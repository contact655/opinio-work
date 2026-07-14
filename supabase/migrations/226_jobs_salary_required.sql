-- Migration 226: Add conditional salary range CHECK to ow_jobs
-- NULL は許容（給与非公開求人を認める）。
-- 両方入力されている場合のみ max >= min を強制する。

ALTER TABLE ow_jobs
  ADD CONSTRAINT ow_jobs_salary_range_check
  CHECK (
    salary_min IS NULL
    OR salary_max IS NULL
    OR salary_max >= salary_min
  );
