-- remote_work_status CHECK 制約に 'other' を追加
ALTER TABLE ow_companies
  DROP CONSTRAINT IF EXISTS ow_companies_remote_work_status_check;

ALTER TABLE ow_companies
  ADD CONSTRAINT ow_companies_remote_work_status_check
  CHECK (remote_work_status IN ('full_remote', 'hybrid', 'on_site', 'other'));
