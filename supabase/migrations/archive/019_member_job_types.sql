-- V-1: Add job_types column to ow_company_members
ALTER TABLE ow_company_members
ADD COLUMN IF NOT EXISTS job_types text[];

-- Populate job_types from existing role column
UPDATE ow_company_members
SET job_types = ARRAY[role]
WHERE job_types IS NULL AND role IS NOT NULL;
