-- migration 198: ow_job_applications に請求管理カラムを追加
-- 成果報酬（採用年収×10%）の請求ステータスを管理する

ALTER TABLE ow_job_applications
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (billing_status IN ('unpaid', 'invoiced', 'paid')),
  ADD COLUMN IF NOT EXISTS billing_note TEXT,
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ow_job_applications_billing_status
  ON ow_job_applications(billing_status)
  WHERE status = 'hired';
