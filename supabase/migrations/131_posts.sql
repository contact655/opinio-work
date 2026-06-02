-- Migration 131: ow_posts / ow_post_likes / ow_post_comments
-- LinkedIn-style 投稿・いいね・コメント機能

-- ── ow_posts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ow_posts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ow_posts_user_id    ON ow_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_ow_posts_created_at ON ow_posts(created_at DESC);

COMMENT ON TABLE  ow_posts           IS '求職者の投稿（LinkedIn-style）';
COMMENT ON COLUMN ow_posts.image_url IS 'Supabase Storage の公開URL（任意）';

-- ── ow_post_likes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ow_post_likes (
  post_id     UUID        NOT NULL REFERENCES ow_posts(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ow_post_likes_post_id ON ow_post_likes(post_id);

-- ── ow_post_comments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ow_post_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID        NOT NULL REFERENCES ow_posts(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ow_post_comments_post_id    ON ow_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_ow_post_comments_created_at ON ow_post_comments(created_at ASC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE ow_posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_post_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_post_comments ENABLE ROW LEVEL SECURITY;

-- ow_posts
CREATE POLICY "anyone_read_posts"      ON ow_posts FOR SELECT USING (true);
CREATE POLICY "auth_insert_posts"      ON ow_posts FOR INSERT WITH CHECK (
  user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid())
);
CREATE POLICY "owner_delete_posts"     ON ow_posts FOR DELETE USING (
  user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid())
);

-- ow_post_likes
CREATE POLICY "anyone_read_likes"      ON ow_post_likes FOR SELECT USING (true);
CREATE POLICY "auth_insert_likes"      ON ow_post_likes FOR INSERT WITH CHECK (
  user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid())
);
CREATE POLICY "owner_delete_likes"     ON ow_post_likes FOR DELETE USING (
  user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid())
);

-- ow_post_comments
CREATE POLICY "anyone_read_comments"   ON ow_post_comments FOR SELECT USING (true);
CREATE POLICY "auth_insert_comments"   ON ow_post_comments FOR INSERT WITH CHECK (
  user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid())
);
CREATE POLICY "owner_delete_comments"  ON ow_post_comments FOR DELETE USING (
  user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid())
);
