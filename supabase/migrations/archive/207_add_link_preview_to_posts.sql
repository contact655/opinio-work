-- Migration 207: ow_posts にリンクプレビュー用カラムを追加
-- 投稿本文からURL抽出 → OGP取得 → 保存するための土台
-- 既存の ow_experience_stories の og_image_url / og_title パターンに準拠しつつ、
-- ow_posts は独立設計のため description と domain も追加

ALTER TABLE ow_posts
  ADD COLUMN IF NOT EXISTS link_url         TEXT,
  ADD COLUMN IF NOT EXISTS link_title       TEXT,
  ADD COLUMN IF NOT EXISTS link_image_url   TEXT,
  ADD COLUMN IF NOT EXISTS link_description TEXT,
  ADD COLUMN IF NOT EXISTS link_domain      TEXT;

COMMENT ON COLUMN ow_posts.link_url         IS '投稿本文から抽出したリンクプレビュー対象URL（最初の1件）';
COMMENT ON COLUMN ow_posts.link_title       IS 'OGPから取得したページタイトル（og:title）';
COMMENT ON COLUMN ow_posts.link_image_url   IS 'OGPから取得したサムネイル画像URL（og:image）';
COMMENT ON COLUMN ow_posts.link_description IS 'OGPから取得したページ説明（og:description）';
COMMENT ON COLUMN ow_posts.link_domain      IS 'link_url から算出したホスト名（表示用）';
