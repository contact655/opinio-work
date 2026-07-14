-- Migration 230: Recreate ow_salary_reports
-- role_id NOT NULL references ow_roles(id) — no free-text fallback.
-- prefecture for regional aggregation.
-- is_flagged for automatic anomaly detection.
-- statistics_opt_out must be applied server-side on all aggregate queries
-- (see ow_users.statistics_opt_out — Migration 227, 利用規約第13条の4第5項).

CREATE TABLE IF NOT EXISTS ow_salary_reports (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID        NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  user_id              UUID        NOT NULL REFERENCES ow_users(id)     ON DELETE CASCADE,
  role_id              UUID        NOT NULL REFERENCES ow_roles(id)     ON DELETE RESTRICT,
  years_of_experience  SMALLINT    CHECK (years_of_experience BETWEEN 0 AND 50),
  annual_salary        INTEGER     NOT NULL
                                   CHECK (annual_salary BETWEEN 1000000 AND 500000000),
  employment_status    TEXT        NOT NULL
                                   CHECK (employment_status IN ('current', 'alumni')),
  prefecture           TEXT,
  is_approved          BOOLEAN     NOT NULL DEFAULT false,
  -- Auto-flagged when salary is suspiciously low/high for IT/SaaS context.
  -- Threshold: < 3,000,000 or > 30,000,000 yen.
  is_flagged           BOOLEAN     NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One report per (user, company, role) combination.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_salary_report_user_company_role
  ON ow_salary_reports(user_id, company_id, role_id);

CREATE INDEX IF NOT EXISTS idx_salary_reports_company
  ON ow_salary_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_salary_reports_role
  ON ow_salary_reports(role_id);
CREATE INDEX IF NOT EXISTS idx_salary_reports_approved
  ON ow_salary_reports(is_approved)
  WHERE is_approved = true;

-- updated_at trigger (reuse existing function if present, else create)
CREATE OR REPLACE FUNCTION set_salary_reports_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_salary_reports_updated_at ON ow_salary_reports;
CREATE TRIGGER trg_salary_reports_updated_at
  BEFORE UPDATE ON ow_salary_reports
  FOR EACH ROW EXECUTE FUNCTION set_salary_reports_updated_at();

-- RLS
ALTER TABLE ow_salary_reports ENABLE ROW LEVEL SECURITY;

-- Users can read / write their own reports (any approval status).
-- Approved aggregate reads are done via service-role admin client (bypasses RLS).
CREATE POLICY "salary_reports_own"
  ON ow_salary_reports
  USING   (user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid() LIMIT 1))
  WITH CHECK (user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid() LIMIT 1));
