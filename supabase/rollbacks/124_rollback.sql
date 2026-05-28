-- Rollback 124: ATS Phase 1 — 選考パイプライン

-- ow_job_applications カラム削除
ALTER TABLE ow_job_applications
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS agent_company,
  DROP COLUMN IF EXISTS pipeline_stage_id,
  DROP COLUMN IF EXISTS external_name,
  DROP COLUMN IF EXISTS external_email,
  DROP COLUMN IF EXISTS memo;

-- ow_pipeline_stages テーブル削除（CASCADE でポリシー・トリガーも削除）
DROP TABLE IF EXISTS ow_pipeline_stages CASCADE;

DROP FUNCTION IF EXISTS update_ow_pipeline_stages_updated_at();
