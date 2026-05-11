-- ============================================================
-- Migration 096: Tighten ow-uploads bucket settings
-- ============================================================
-- 段階6-4 Phase 3
--
-- Purpose:
--   ow-uploads バケットに file_size_limit と allowed_mime_types を
--   設定する。現状は両方 null で、巨大ファイルや任意 MIME タイプの
--   アップロードが可能な状態。
--
-- Settings:
--   - file_size_limit: 5 MB (5,242,880 bytes)
--     StoryAccordion UI の制限と一致。既存 7 件は全て 600KB 以下。
--   - allowed_mime_types: image/jpeg, image/png, image/webp, image/gif
--     企業ロゴ・オフィス写真・story 画像は全て画像のみ。
--     将来 PDF/動画が必要になったら別 migration で MIME 追加。
--
-- Prerequisites:
--   - Migration 095(allow_all_storage 削除)適用済み
--
-- Effect after apply:
--   - 5MB 超のアップロードは Storage 層で拒否される
--   - 画像 4 種以外の MIME タイプは Storage 層で拒否される
--   - SELECT/DELETE/UPDATE には影響なし(設定はアップロード時のみ作用)
--
-- Rollback: supabase/rollbacks/096_storage_bucket_settings_rollback.sql
-- ============================================================

UPDATE storage.buckets
SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'ow-uploads';
