-- migration 089: ow_experience_stories
-- 経歴に紐づくビジュアルリッチストーリー (画像/カード/動画/リンク)
-- RLS: experience_id 経由で user_id を引いて auth_id 比較する 2 段階構造

CREATE TABLE ow_experience_stories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id   uuid NOT NULL REFERENCES ow_experiences(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('image', 'card', 'video', 'link')),
  title           text CHECK (char_length(title) <= 100),
  description     text CHECK (char_length(description) <= 500),
  image_url       text CHECK (char_length(image_url) <= 1000),
  video_url       text CHECK (char_length(video_url) <= 1000),
  link_url        text CHECK (char_length(link_url) <= 1000),
  period_start    date,
  period_end      date,
  sort_order      integer NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ow_experience_stories_experience_id_idx ON ow_experience_stories(experience_id);

ALTER TABLE ow_experience_stories ENABLE ROW LEVEL SECURITY;

-- 全員閲覧可
CREATE POLICY ow_experience_stories_select_all
  ON ow_experience_stories FOR SELECT USING (true);

-- 自分の経歴に紐づくストーリーのみ INSERT/UPDATE/DELETE 可
-- experience_id → ow_experiences.user_id → ow_users.auth_id で 2 段階チェック
CREATE POLICY ow_experience_stories_insert_own
  ON ow_experience_stories FOR INSERT
  WITH CHECK (
    experience_id IN (
      SELECT e.id FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY ow_experience_stories_update_own
  ON ow_experience_stories FOR UPDATE
  USING (
    experience_id IN (
      SELECT e.id FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY ow_experience_stories_delete_own
  ON ow_experience_stories FOR DELETE
  USING (
    experience_id IN (
      SELECT e.id FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

COMMENT ON TABLE ow_experience_stories IS
  '経歴に紐づくビジュアルリッチストーリー(画像/カード/動画/リンク)。1 経歴 = 0..N ストーリー、sort_order で表示順管理。';

-- ロールバック: DROP TABLE ow_experience_stories;
