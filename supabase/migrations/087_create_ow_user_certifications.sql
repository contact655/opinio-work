-- ν-8 段階6-2 コミット D-1: ow_user_certifications テーブル作成
-- ロールバック: DROP TABLE ow_user_certifications;

CREATE TABLE ow_user_certifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  issuer      text CHECK (char_length(issuer) <= 100),
  issued_at   date,
  expires_at  date,
  no_expiry   boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ow_user_certifications_user_id_idx ON ow_user_certifications(user_id);

-- RLS
ALTER TABLE ow_user_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY ow_user_certifications_select_all
  ON ow_user_certifications FOR SELECT USING (true);

CREATE POLICY ow_user_certifications_insert_own
  ON ow_user_certifications FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

CREATE POLICY ow_user_certifications_update_own
  ON ow_user_certifications FOR UPDATE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

CREATE POLICY ow_user_certifications_delete_own
  ON ow_user_certifications FOR DELETE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

COMMENT ON TABLE ow_user_certifications IS
  '求職者の資格・認定。1ユーザー = 0..N レコード、sort_order で表示順管理。';
