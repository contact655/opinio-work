-- migration 090: ow_user_achievements
-- 実績(数値で語れる成果物)。例: "インタビュー記事出演数 86本"

CREATE TABLE ow_user_achievements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  value         integer,
  unit          text CHECK (char_length(unit) <= 20),
  description   text CHECK (char_length(description) <= 500),
  period_start  date,
  period_end    date,
  sort_order    integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ow_user_achievements_user_id_idx ON ow_user_achievements(user_id);

ALTER TABLE ow_user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY ow_user_achievements_select_all
  ON ow_user_achievements FOR SELECT USING (true);

CREATE POLICY ow_user_achievements_insert_own
  ON ow_user_achievements FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

CREATE POLICY ow_user_achievements_update_own
  ON ow_user_achievements FOR UPDATE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

CREATE POLICY ow_user_achievements_delete_own
  ON ow_user_achievements FOR DELETE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

COMMENT ON TABLE ow_user_achievements IS
  '実績(数値で語れる成果物)。例: "インタビュー記事出演数 86本"、"テレビ番組出演数 120回"。';

-- ロールバック: DROP TABLE ow_user_achievements;
