-- ν-8 段階6-2 コミット C-1: ow_user_educations テーブル作成
-- ロールバック: DROP TABLE ow_user_educations;

CREATE TABLE ow_user_educations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  school       text NOT NULL CHECK (char_length(school) BETWEEN 1 AND 100),
  faculty      text CHECK (char_length(faculty) <= 100),
  degree       text CHECK (degree IN ('高校卒', '専門卒', '短大卒', '学士', '修士', '博士', 'その他')),
  enrolled_at  date,
  graduated_at date,
  is_current   boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ow_user_educations_user_id_idx ON ow_user_educations(user_id);

-- RLS
ALTER TABLE ow_user_educations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ow_user_educations_select_all
  ON ow_user_educations FOR SELECT USING (true);

CREATE POLICY ow_user_educations_insert_own
  ON ow_user_educations FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

CREATE POLICY ow_user_educations_update_own
  ON ow_user_educations FOR UPDATE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

CREATE POLICY ow_user_educations_delete_own
  ON ow_user_educations FOR DELETE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

COMMENT ON TABLE ow_user_educations IS
  '求職者の学歴。1ユーザー = 0..N レコード、sort_order で表示順管理。';
