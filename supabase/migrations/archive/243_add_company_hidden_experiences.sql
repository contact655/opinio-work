-- 企業が社員の経歴を自社ページから非表示にする機能
-- ow_experiences は変更せず、別テーブルで非表示判断を管理する

CREATE TABLE ow_company_hidden_experiences (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  experience_id  UUID NOT NULL REFERENCES ow_experiences(id) ON DELETE CASCADE,
  hidden_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  hidden_by      UUID REFERENCES ow_company_admins(id) ON DELETE SET NULL,
  UNIQUE (company_id, experience_id)
);

ALTER TABLE ow_company_hidden_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_admin_manage_own_hidden"
  ON ow_company_hidden_experiences
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ow_company_admins ca
      JOIN ow_users u ON u.id = ca.user_id
      WHERE u.auth_id = auth.uid()
        AND ca.company_id = ow_company_hidden_experiences.company_id
        AND ca.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ow_company_admins ca
      JOIN ow_users u ON u.id = ca.user_id
      WHERE u.auth_id = auth.uid()
        AND ca.company_id = ow_company_hidden_experiences.company_id
        AND ca.is_active = true
    )
  );

CREATE POLICY "service_role_all"
  ON ow_company_hidden_experiences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_company_hidden_exp_company
  ON ow_company_hidden_experiences (company_id);
