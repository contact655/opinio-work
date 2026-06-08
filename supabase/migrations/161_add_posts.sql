-- Migration 161: ow_posts + ow_post_likes
-- LinkedIn/Wantedly スタイルのアクティビティ投稿機能
-- ユーザーが近況・知見・ニュースを発信できるテーブル

CREATE TABLE IF NOT EXISTS ow_posts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ow_post_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES ow_posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ow_posts_user_id    ON ow_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_ow_posts_created_at ON ow_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ow_post_likes_post_id ON ow_post_likes(post_id);

-- RLS
ALTER TABLE ow_posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_post_likes ENABLE ROW LEVEL SECURITY;

-- ow_posts policies
CREATE POLICY "posts_select_public" ON ow_posts
  FOR SELECT USING (true);

CREATE POLICY "posts_insert_own" ON ow_posts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid() LIMIT 1));

CREATE POLICY "posts_delete_own" ON ow_posts
  FOR DELETE TO authenticated
  USING (user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid() LIMIT 1));

-- ow_post_likes policies
CREATE POLICY "post_likes_select_public" ON ow_post_likes
  FOR SELECT USING (true);

CREATE POLICY "post_likes_insert_own" ON ow_post_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid() LIMIT 1));

CREATE POLICY "post_likes_delete_own" ON ow_post_likes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid() LIMIT 1));

COMMENT ON TABLE ow_posts      IS 'ユーザーのアクティビティ投稿（LinkedIn/Wantedly スタイル）';
COMMENT ON TABLE ow_post_likes IS 'ow_posts へのいいね（ユーザーごとに1回）';
