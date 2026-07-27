-- ============================================================
-- Migration 097: Add OGP columns to ow_experience_stories
-- ============================================================
-- 段階6-5 Phase 1
--
-- Purpose:
--   link type のストーリーに OGP(Open Graph Protocol)プレビューを
--   保存できるよう、ow_experience_stories テーブルに 2 カラム追加する。
--
-- Columns:
--   - og_image_url (text, nullable): og:image の URL
--   - og_title (text, nullable): og:title
--
-- Nullable rationale:
--   - 既存 link type ストーリーは null のまま(段階6-5 判断点 6: 案 m)
--   - OGP 取得失敗時も null で保存(段階6-5 判断点 2: 案 α)
--
-- Affected types: link type のみ実質的に使用
--   image/video/card type は OGP 概念がないため null のまま運用
--
-- Rollback: supabase/rollbacks/097_add_ogp_columns_to_experience_stories_rollback.sql
-- ============================================================

ALTER TABLE ow_experience_stories
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS og_title text;

-- カラムコメント(運用上のドキュメンテーション)
COMMENT ON COLUMN ow_experience_stories.og_image_url IS
  'Open Graph image URL fetched at save time. NULL if not fetched or fetch failed. Used for link type stories.';

COMMENT ON COLUMN ow_experience_stories.og_title IS
  'Open Graph title fetched at save time. NULL if not fetched or fetch failed. Used for link type stories.';
