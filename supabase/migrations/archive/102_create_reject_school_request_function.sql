-- ============================================================
-- Migration 102: Create reject_school_request PostgreSQL function
-- ============================================================
-- 段階7-F Phase 4
--
-- Purpose:
--   学校追加リクエストを却下する関数。
--   Migration 101 (approve_school_request) と対称的な設計。
--
-- Function signature:
--   reject_school_request(
--     p_request_id    uuid,
--     p_approved_by   uuid       -- auth.users.id (運営管理者)
--   ) RETURNS TABLE (rejected_at timestamptz)
--
-- Error codes:
--   P0001 — リクエストが見つからない
--   P0002 — リクエストが pending 状態でない
--
-- Notes:
--   - approved_at カラムを rejected_at として再利用(専用カラムは追加しない)
--   - SECURITY DEFINER + SET row_security = off (PG15+ 必須)
--   - FOR UPDATE による排他ロック(同時却下の競合防止)
--
-- Prerequisites:
--   - Migration 100 (ow_school_requests) 適用済み
--   - Migration 101 (approve_school_request) 適用済み
--
-- Rollback: supabase/rollbacks/102_create_reject_school_request_function_rollback.sql
-- ============================================================

CREATE OR REPLACE FUNCTION reject_school_request(
  p_request_id  uuid,
  p_approved_by uuid   -- auth.users.id
)
RETURNS TABLE (rejected_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_request     ow_school_requests%ROWTYPE;
  v_approver_id uuid;
  v_now         timestamptz := now();
BEGIN
  -- ── 1. リクエスト取得 (FOR UPDATE で排他ロック) ──────────────────────────
  SELECT *
  INTO   v_request
  FROM   ow_school_requests
  WHERE  id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found: %', p_request_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request is not pending (current status: %)', v_request.status
      USING ERRCODE = 'P0002';
  END IF;

  -- ── 2. 承認者(却下者)の ow_users.id を解決 ──────────────────────────────
  SELECT id
  INTO   v_approver_id
  FROM   ow_users
  WHERE  auth_id = p_approved_by
  LIMIT  1;

  -- ── 3. ow_school_requests を rejected に UPDATE ──────────────────────────
  UPDATE ow_school_requests
  SET
    status      = 'rejected',
    approved_at = v_now,      -- rejected_at として再利用
    approved_by = v_approver_id
  WHERE id = p_request_id;

  -- ── 4. 結果を返す ─────────────────────────────────────────────────────────
  RETURN QUERY
    SELECT v_now AS rejected_at;
END;
$$;

-- 実行権限: service role のみ(PUBLIC + authenticated から REVOKE)
REVOKE ALL ON FUNCTION reject_school_request(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION reject_school_request(uuid, uuid) FROM authenticated;
