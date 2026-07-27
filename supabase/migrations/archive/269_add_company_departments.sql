-- ow_company_departments: 企業ごとの部門マスタ（階層構造）
CREATE TABLE IF NOT EXISTS ow_company_departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES ow_company_departments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, name, parent_id)
);

ALTER TABLE ow_company_departments ENABLE ROW LEVEL SECURITY;

-- 企業管理者は自社の部門を全操作可能
CREATE POLICY "company admins manage departments"
  ON ow_company_departments FOR ALL
  USING (auth_is_company_admin(company_id));

-- 公開企業の部門は誰でも閲覧可能
CREATE POLICY "public read published departments"
  ON ow_company_departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ow_companies
      WHERE id = company_id AND is_published = true
    )
  );

-- ow_jobs に department_id FK を追加（既存 department TEXT は残す）
ALTER TABLE ow_jobs
  ADD COLUMN IF NOT EXISTS department_id UUID
  REFERENCES ow_company_departments(id) ON DELETE SET NULL;

-- ow_experiences に department_id FK を追加（既存 department TEXT は残す）
ALTER TABLE ow_experiences
  ADD COLUMN IF NOT EXISTS department_id UUID
  REFERENCES ow_company_departments(id) ON DELETE SET NULL;
