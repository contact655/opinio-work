-- ============================================================
-- Rollback 096: Restore ow-uploads bucket settings to unlimited
-- ============================================================
-- WARNING: rollback は ow-uploads を「ファイルサイズ無制限・全 MIME 受入」
-- の状態に戻します。緊急時のみ適用してください。
-- ============================================================

UPDATE storage.buckets
SET
  file_size_limit = NULL,
  allowed_mime_types = NULL
WHERE id = 'ow-uploads';
