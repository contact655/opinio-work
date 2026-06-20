-- migration 197: ow_mentor_reservations テーブル作成
-- メンター相談予約の永続化。Phase 1 スキーマ（migration 031）で定義されていたが
-- Supabase 上には未適用だったため、現在の FK 名（ow_mentors）で再作成する。

CREATE TABLE IF NOT EXISTS ow_mentor_reservations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES ow_users(id)   ON DELETE CASCADE,
  mentor_id         UUID                 REFERENCES ow_mentors(id) ON DELETE SET NULL,
  mentor_user_id    UUID                 REFERENCES ow_users(id)   ON DELETE SET NULL,

  -- 申込内容
  themes            TEXT[],
  current_situation TEXT,
  questions         TEXT,
  background        TEXT,

  -- 希望日程・連絡先
  preferred_days    TEXT[],
  preferred_times   TEXT[],
  contact_email     TEXT NOT NULL,
  preferred_platform TEXT,

  -- ステータス
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN (
      'pending_review', 'approved', 'rejected',
      'scheduled', 'completed', 'cancelled'
    )),

  -- 編集部・メンター内部メモ
  editor_note  TEXT,
  mentor_note  TEXT,
  scheduled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_ow_mentor_reservations_user_id
  ON ow_mentor_reservations(user_id);

CREATE INDEX IF NOT EXISTS idx_ow_mentor_reservations_mentor_id
  ON ow_mentor_reservations(mentor_id);

CREATE INDEX IF NOT EXISTS idx_ow_mentor_reservations_status
  ON ow_mentor_reservations(status);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_mentor_reservations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mentor_reservations_updated_at ON ow_mentor_reservations;
CREATE TRIGGER trg_mentor_reservations_updated_at
  BEFORE UPDATE ON ow_mentor_reservations
  FOR EACH ROW EXECUTE FUNCTION update_mentor_reservations_updated_at();

-- RLS
ALTER TABLE ow_mentor_reservations ENABLE ROW LEVEL SECURITY;

-- 本人は自分の予約を全操作可能
CREATE POLICY "user can manage own reservations"
  ON ow_mentor_reservations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ow_users
      WHERE ow_users.id = ow_mentor_reservations.user_id
        AND ow_users.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ow_users
      WHERE ow_users.id = ow_mentor_reservations.user_id
        AND ow_users.auth_id = auth.uid()
    )
  );

-- admin は全件閲覧・更新可能（service_role は RLS バイパス）
CREATE POLICY "admin can view all reservations"
  ON ow_mentor_reservations
  FOR SELECT
  USING (auth_is_admin());

CREATE POLICY "admin can update all reservations"
  ON ow_mentor_reservations
  FOR UPDATE
  USING (auth_is_admin());
