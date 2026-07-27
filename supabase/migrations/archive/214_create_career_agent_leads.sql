-- migration 214: キャリアエージェント相談申込テーブル
-- /career-agent フォームの送信内容を保存し、管理者がリード管理できるようにする。

CREATE TABLE IF NOT EXISTS ow_career_agent_leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  current_job   TEXT NOT NULL,
  timeline      TEXT NOT NULL,
  message       TEXT,

  -- ステータス管理
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'meeting_scheduled', 'in_progress', 'closed', 'rejected')),

  -- 管理者メモ
  admin_note    TEXT,
  assigned_to   TEXT,

  -- ユーザー連携（任意：後から紐づけ可能）
  user_id       UUID REFERENCES ow_users(id) ON DELETE SET NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ow_career_agent_leads_status  ON ow_career_agent_leads(status);
CREATE INDEX IF NOT EXISTS idx_ow_career_agent_leads_email   ON ow_career_agent_leads(email);
CREATE INDEX IF NOT EXISTS idx_ow_career_agent_leads_created ON ow_career_agent_leads(created_at DESC);

CREATE OR REPLACE FUNCTION update_career_agent_leads_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_career_agent_leads_updated_at ON ow_career_agent_leads;
CREATE TRIGGER trg_career_agent_leads_updated_at
  BEFORE UPDATE ON ow_career_agent_leads
  FOR EACH ROW EXECUTE FUNCTION update_career_agent_leads_updated_at();

ALTER TABLE ow_career_agent_leads ENABLE ROW LEVEL SECURITY;

-- 管理者のみ全件操作可能（一般ユーザーはアクセス不可）
DROP POLICY IF EXISTS "admin can manage career agent leads" ON ow_career_agent_leads;
CREATE POLICY "admin can manage career agent leads"
  ON ow_career_agent_leads FOR ALL USING (auth_is_admin());
