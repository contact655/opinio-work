-- ============================================================
-- Rollback for Migration 101
-- ============================================================
-- approve_school_request 関数を削除する
-- ============================================================

DROP FUNCTION IF EXISTS approve_school_request(uuid, text, text, uuid);
