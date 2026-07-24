-- Migration 270: 会社固有職種名テーブル新設 + ow_jobs への FK 追加
-- ow_company_job_roles: 企業が登録する自社の呼び方（例: "FS"）と標準職種（ow_roles）の紐づけ
-- 表示は自社名、検索・マッチングは standard_role_id で行う 2層構造

-- NOTE: CREATE TABLE と ALTER TABLE は本番 DB に手動適用済み（2026-07-24）
-- このファイルはソース管理用の記録。IF NOT EXISTS で冪等性を担保している。

CREATE TABLE IF NOT EXISTS ow_company_job_roles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  standard_role_id UUID        REFERENCES ow_roles(id) ON DELETE SET NULL,
  display_order    INT         NOT NULL DEFAULT 0,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, name)
);

ALTER TABLE ow_jobs
  ADD COLUMN IF NOT EXISTS company_job_role_id UUID
    REFERENCES ow_company_job_roles(id)
    ON DELETE SET NULL;

-- RLS
ALTER TABLE ow_company_job_roles ENABLE ROW LEVEL SECURITY;

-- 自社の管理者は全操作可
DROP POLICY IF EXISTS "company admins manage job roles" ON ow_company_job_roles;
CREATE POLICY "company admins manage job roles"
  ON ow_company_job_roles
  FOR ALL
  USING (auth_is_company_admin(company_id));

-- 全ユーザー（anon 含む）は論理削除されていない行を読み取り可
-- ※ 求人詳細ページ等で公開表示に使うため
DROP POLICY IF EXISTS "public read active job roles" ON ow_company_job_roles;
CREATE POLICY "public read active job roles"
  ON ow_company_job_roles
  FOR SELECT
  USING (deleted_at IS NULL);
