-- Migration 125: エージェントポータル
-- 2026-05-28
--
-- 概要:
--   1. ow_agent_agencies — 人材紹介会社（代理店）
--   2. ow_agent_contacts — 担当者（複数名が同じ agency を共有）
--   3. ow_agent_jobs     — エージェント×求人の紐付け（多対多）
--   4. ow_job_applications に agency_id を追加
--
-- ロールバック: supabase/rollbacks/125_rollback.sql

-- ── 1. ow_agent_agencies ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ow_agent_agencies (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  agency_name  TEXT        NOT NULL,               -- 例: 株式会社リクルートエージェント
  memo         TEXT,                               -- 内部メモ（求職者には非表示）
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ow_agent_agencies_company_id_idx
  ON ow_agent_agencies(company_id);

-- RLS
ALTER TABLE ow_agent_agencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_agencies_select"
  ON ow_agent_agencies FOR SELECT
  USING (auth_is_company_member(company_id));

CREATE POLICY "agent_agencies_insert"
  ON ow_agent_agencies FOR INSERT
  WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY "agent_agencies_update"
  ON ow_agent_agencies FOR UPDATE
  USING (auth_is_company_member(company_id))
  WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY "agent_agencies_delete"
  ON ow_agent_agencies FOR DELETE
  USING (auth_is_company_member(company_id));

-- ── 2. ow_agent_contacts ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ow_agent_contacts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID        NOT NULL REFERENCES ow_agent_agencies(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,               -- 担当者名
  email       TEXT        NOT NULL,               -- ログイン用メール（magic link）
  is_primary  BOOLEAN     NOT NULL DEFAULT false, -- 主担当フラグ
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ow_agent_contacts_agency_id_idx
  ON ow_agent_contacts(agency_id);

CREATE INDEX IF NOT EXISTS ow_agent_contacts_email_idx
  ON ow_agent_contacts(email);

-- RLS（エージェント本人も読み取り可能にするため、email照合ポリシーを追加）
ALTER TABLE ow_agent_contacts ENABLE ROW LEVEL SECURITY;

-- 企業メンバーは全件操作可
CREATE POLICY "agent_contacts_company_member"
  ON ow_agent_contacts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ow_agent_agencies a
      WHERE a.id = ow_agent_contacts.agency_id
        AND auth_is_company_member(a.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ow_agent_agencies a
      WHERE a.id = ow_agent_contacts.agency_id
        AND auth_is_company_member(a.company_id)
    )
  );

-- エージェント本人は自分の所属 agency を読み取り可
CREATE POLICY "agent_contacts_self_select"
  ON ow_agent_contacts FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

-- ── 3. ow_agent_jobs ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ow_agent_jobs (
  agency_id  UUID NOT NULL REFERENCES ow_agent_agencies(id) ON DELETE CASCADE,
  job_id     UUID NOT NULL REFERENCES ow_jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, job_id)
);

CREATE INDEX IF NOT EXISTS ow_agent_jobs_agency_id_idx ON ow_agent_jobs(agency_id);
CREATE INDEX IF NOT EXISTS ow_agent_jobs_job_id_idx    ON ow_agent_jobs(job_id);

-- RLS
ALTER TABLE ow_agent_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_jobs_company_member"
  ON ow_agent_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ow_agent_agencies a
      JOIN ow_jobs j ON j.id = ow_agent_jobs.job_id
      WHERE a.id = ow_agent_jobs.agency_id
        AND auth_is_company_member(a.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ow_agent_agencies a
      WHERE a.id = ow_agent_jobs.agency_id
        AND auth_is_company_member(a.company_id)
    )
  );

-- エージェント本人は自分の agency の紐付け求人を読み取り可
CREATE POLICY "agent_jobs_agent_select"
  ON ow_agent_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ow_agent_contacts c
      WHERE c.agency_id = ow_agent_jobs.agency_id
        AND c.email = (SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1)
    )
  );

-- ── 4. ow_job_applications に agency_id 追加 ──────────────────────────────

ALTER TABLE ow_job_applications
  ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES ow_agent_agencies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ow_job_applications_agency_id_idx
  ON ow_job_applications(agency_id);

-- ── 5. updated_at トリガー ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_ow_agent_agencies_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ow_agent_agencies_updated_at
  BEFORE UPDATE ON ow_agent_agencies
  FOR EACH ROW EXECUTE FUNCTION update_ow_agent_agencies_updated_at();
