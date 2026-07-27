-- migration 091: ow_user_awards
-- 受賞歴。例: "PERSOL Work-Style AWARD 2021"

CREATE TABLE ow_user_awards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  issuer        text CHECK (char_length(issuer) <= 100),
  awarded_at    date,
  description   text CHECK (char_length(description) <= 500),
  sort_order    integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ow_user_awards_user_id_idx ON ow_user_awards(user_id);

ALTER TABLE ow_user_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY ow_user_awards_select_all
  ON ow_user_awards FOR SELECT USING (true);

CREATE POLICY ow_user_awards_insert_own
  ON ow_user_awards FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

CREATE POLICY ow_user_awards_update_own
  ON ow_user_awards FOR UPDATE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

CREATE POLICY ow_user_awards_delete_own
  ON ow_user_awards FOR DELETE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

COMMENT ON TABLE ow_user_awards IS
  '受賞歴。例: "PERSOL Work-Style AWARD 2021"、"Mizuho Innovation Award 2020"。';

-- ロールバック: DROP TABLE ow_user_awards;
