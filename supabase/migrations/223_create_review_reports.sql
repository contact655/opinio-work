-- Migration 223: create ow_review_reports table for review flagging
CREATE TABLE IF NOT EXISTS ow_review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES ow_company_reviews(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  detail TEXT,
  contact_email TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ow_review_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON ow_review_reports FOR ALL USING (auth_is_admin());
CREATE POLICY "anyone_insert" ON ow_review_reports FOR INSERT WITH CHECK (true);
