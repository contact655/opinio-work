-- migration 092: ow_user_media_appearances
-- メディア出演履歴。例: "BSテレ東 カンブリア宮殿"、"NewsPicks インタビュー記事"

CREATE TABLE ow_user_media_appearances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  media_name    text CHECK (char_length(media_name) <= 100),
  url           text CHECK (char_length(url) <= 1000),
  thumbnail_url text CHECK (char_length(thumbnail_url) <= 1000),
  appeared_at   date,
  description   text CHECK (char_length(description) <= 500),
  sort_order    integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ow_user_media_appearances_user_id_idx ON ow_user_media_appearances(user_id);

ALTER TABLE ow_user_media_appearances ENABLE ROW LEVEL SECURITY;

CREATE POLICY ow_user_media_appearances_select_all
  ON ow_user_media_appearances FOR SELECT USING (true);

CREATE POLICY ow_user_media_appearances_insert_own
  ON ow_user_media_appearances FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

CREATE POLICY ow_user_media_appearances_update_own
  ON ow_user_media_appearances FOR UPDATE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

CREATE POLICY ow_user_media_appearances_delete_own
  ON ow_user_media_appearances FOR DELETE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

COMMENT ON TABLE ow_user_media_appearances IS
  'メディア出演履歴。例: "BSテレ東 カンブリア宮殿"、"NewsPicks インタビュー記事"。';

-- ロールバック: DROP TABLE ow_user_media_appearances;
