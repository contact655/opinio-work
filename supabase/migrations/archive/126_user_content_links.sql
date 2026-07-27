-- ── Migration 126: user_content_links + articles.user_id ─────────────────────
--
-- 1. ow_articles に user_id を追加（管理者が記事と掲載人物を紐づける）
-- 2. ow_user_content_links テーブルを新規作成（note/Zenn/YouTube 等の外部発信コンテンツ）
--

-- 1. ow_articles.user_id
ALTER TABLE ow_articles
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES ow_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ow_articles_user_id_idx ON ow_articles(user_id)
  WHERE user_id IS NOT NULL;

-- 2. ow_user_content_links
CREATE TABLE IF NOT EXISTS ow_user_content_links (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  platform    TEXT,        -- 'youtube' | 'note' | 'zenn' | 'speakerdeck' | 'podcast' | 'github' | 'other'
  title       TEXT,
  description TEXT,
  thumbnail_url TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE ow_user_content_links ENABLE ROW LEVEL SECURITY;

-- 全員が読める
CREATE POLICY "ow_ucl_select_all" ON ow_user_content_links
  FOR SELECT USING (true);

-- 自分のレコードのみ INSERT
CREATE POLICY "ow_ucl_insert_own" ON ow_user_content_links
  FOR INSERT WITH CHECK (
    user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid())
  );

-- 自分のレコードのみ UPDATE
CREATE POLICY "ow_ucl_update_own" ON ow_user_content_links
  FOR UPDATE USING (
    user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid())
  );

-- 自分のレコードのみ DELETE
CREATE POLICY "ow_ucl_delete_own" ON ow_user_content_links
  FOR DELETE USING (
    user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid())
  );
