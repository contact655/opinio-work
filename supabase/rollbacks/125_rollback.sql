-- Rollback 125: エージェントポータル

ALTER TABLE ow_job_applications DROP COLUMN IF EXISTS agency_id;

DROP TABLE IF EXISTS ow_agent_jobs CASCADE;
DROP TABLE IF EXISTS ow_agent_contacts CASCADE;
DROP TABLE IF EXISTS ow_agent_agencies CASCADE;

DROP FUNCTION IF EXISTS update_ow_agent_agencies_updated_at();
