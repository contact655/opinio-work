-- Migration 204: ow_post_comments テーブル追加
-- migration 161 で ow_post_likes の構造を更新した際に ow_post_comments が欠落したため追加
-- FeedClient.tsx + /api/jobseeker/posts/[id]/comments に対応するテーブル定義

-- ── ow_post_comments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ow_post_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES ow_posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ow_post_comments_post_id    ON ow_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_ow_post_comments_created_at ON ow_post_comments(created_at ASC);

COMMENT ON TABLE  ow_post_comments         IS 'ow_posts へのコメント（1投稿あたり最大50件表示）';
COMMENT ON COLUMN ow_post_comments.content IS '本文 1〜300文字';

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE ow_post_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: 誰でも読める（ow_posts が全公開のため）
CREATE POLICY "post_comments_select_public" ON ow_post_comments
  FOR SELECT USING (true);

-- INSERT: 認証済みユーザーが自分の user_id でのみ投稿可
CREATE POLICY "post_comments_insert_own" ON ow_post_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- DELETE: 自分のコメントのみ削除可（APIでもオーナーチェック済み）
CREATE POLICY "post_comments_delete_own" ON ow_post_comments
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid() LIMIT 1)
  );
