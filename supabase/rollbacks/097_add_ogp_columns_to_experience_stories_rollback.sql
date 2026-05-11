-- ============================================================
-- Rollback 097: Drop OGP columns from ow_experience_stories
-- ============================================================
-- WARNING: rollback すると og_image_url / og_title に保存された全データが
-- 失われます。実行前に必要なら SELECT で内容を退避してください。
-- ============================================================

ALTER TABLE ow_experience_stories
  DROP COLUMN IF EXISTS og_image_url,
  DROP COLUMN IF EXISTS og_title;
