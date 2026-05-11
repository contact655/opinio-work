-- ============================================================
-- Rollback 099: Drop school_id column from ow_user_educations
-- ============================================================
-- WARNING:
--   - school_id に保存された全データが失われます
--   - ただし school (text) は残るため、学歴情報自体は損なわれません
--   - Migration 098 (ow_schools) を rollback する前に本ファイルを先に実行してください
--     (CASCADE で自動的に削除されますが、明示的に分離する方が安全)
-- ============================================================

DROP INDEX IF EXISTS ow_user_educations_school_id_idx;

ALTER TABLE ow_user_educations
  DROP COLUMN IF EXISTS school_id;
