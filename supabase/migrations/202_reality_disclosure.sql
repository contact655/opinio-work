-- Migration 202: reality_disclosure + contact_logs
-- 企業の"本音情報"開示カラム追加 + 候補者接触ログテーブル

-- ① ow_companies に reality_disclosure JSONB カラムを追加
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS reality_disclosure JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN ow_companies.reality_disclosure IS
  'リアル開示情報: { not_for: string, turnover_reasons: string[], onboarding_gaps: string }';

-- ② ow_contact_logs — Opinio経由の候補者接触をすべて記録（課金追跡の布石）
CREATE TABLE IF NOT EXISTS ow_contact_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  actor_user_id    UUID NOT NULL,   -- 操作した企業担当者の ow_users.id
  candidate_user_id UUID,           -- 対象の候補者 ow_users.id（NULL = 匿名閲覧等）
  job_id           UUID,            -- 関連求人
  action_type      TEXT NOT NULL CHECK (action_type IN (
    'email_reveal',    -- 候補者メール開示
    'direct_message',  -- メッセージ送信
    'job_apply_view',  -- 応募者プロフィール閲覧
    'scout_view',      -- スカウト候補閲覧
    'profile_view'     -- 公開プロフィール閲覧（企業側）
  )),
  metadata         JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ow_contact_logs_company_id_idx
  ON ow_contact_logs(company_id);
CREATE INDEX IF NOT EXISTS ow_contact_logs_candidate_user_id_idx
  ON ow_contact_logs(candidate_user_id);
CREATE INDEX IF NOT EXISTS ow_contact_logs_created_at_idx
  ON ow_contact_logs(created_at DESC);

ALTER TABLE ow_contact_logs ENABLE ROW LEVEL SECURITY;

-- 企業担当者は自社ログを閲覧のみ
CREATE POLICY "company admins can view own contact logs"
  ON ow_contact_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ow_company_admins ca
      WHERE ca.company_id = ow_contact_logs.company_id
        AND ca.user_id = auth.uid()
    )
  );

-- 書き込みは service_role のみ（API Route 経由）
CREATE POLICY "service_role full access to contact logs"
  ON ow_contact_logs FOR ALL
  USING (auth.role() = 'service_role');
