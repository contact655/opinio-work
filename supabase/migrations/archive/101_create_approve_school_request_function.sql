-- ============================================================
-- Migration 101: Create approve_school_request PostgreSQL function
-- ============================================================
-- 段階7-F Phase 3
--
-- Purpose:
--   学校追加リクエストを承認する際の 3 ステップを
--   アトミックなトランザクションとして実行する関数。
--
--   Step 1: ow_school_requests.status が 'pending' か確認 (FOR UPDATE ロック)
--   Step 2: ow_schools に新しい学校を INSERT
--   Step 3: ow_school_requests を 'approved' に UPDATE
--   Step 4: 同名学校の ow_user_educations.school_id を一括 UPDATE
--
-- Function signature:
--   approve_school_request(
--     p_request_id    uuid,      -- ow_school_requests.id
--     p_logo_letter   text,      -- 1文字フォールバック
--     p_logo_gradient text,      -- CSS gradient
--     p_approved_by   uuid       -- auth.users.id (運営管理者)
--   ) RETURNS TABLE (school_id uuid, updated_educations_count integer)
--
-- Error codes:
--   P0001 — リクエストが見つからない
--   P0002 — リクエストが pending 状態でない (既に approved/rejected)
--
-- Notes:
--   - SECURITY DEFINER + SET row_security = off で RLS をバイパス
--     (PG15+ は SECURITY DEFINER でも RLS が適用されるため SET が必須)
--   - p_approved_by は auth.users.id。ow_users への解決は関数内で行う
--   - country='JP', type='university' 固定 (将来拡張のため関数シグネチャに含まない)
--
-- Prerequisites:
--   - Migration 098 (ow_schools) 適用済み
--   - Migration 099 (ow_user_educations.school_id) 適用済み
--   - Migration 100 (ow_school_requests) 適用済み
--
-- Rollback: supabase/rollbacks/101_create_approve_school_request_function_rollback.sql
-- ============================================================

CREATE OR REPLACE FUNCTION approve_school_request(
  p_request_id    uuid,
  p_logo_letter   text,
  p_logo_gradient text,
  p_approved_by   uuid   -- auth.users.id
)
RETURNS TABLE (school_id uuid, updated_educations_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_request       ow_school_requests%ROWTYPE;
  v_new_school_id uuid;
  v_updated_count integer;
  v_approver_id   uuid;  -- ow_users.id
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

  -- ── 2. 承認者の ow_users.id を解決 ──────────────────────────────────────
  --    auth.users.id → ow_users.id (一致しない場合は NULL のまま許容)
  SELECT id
  INTO   v_approver_id
  FROM   ow_users
  WHERE  auth_id = p_approved_by
  LIMIT  1;

  -- ── 3. ow_schools に INSERT ──────────────────────────────────────────────
  INSERT INTO ow_schools (
    name,
    name_kana,
    logo_letter,
    logo_gradient,
    country,
    type
  )
  VALUES (
    v_request.school_name,
    v_request.school_name_kana,
    p_logo_letter,
    p_logo_gradient,
    'JP',
    'university'
  )
  RETURNING id INTO v_new_school_id;

  -- ── 4. ow_school_requests を承認済みに更新 ───────────────────────────────
  UPDATE ow_school_requests
  SET
    status             = 'approved',
    approved_school_id = v_new_school_id,
    approved_at        = now(),
    approved_by        = v_approver_id
  WHERE id = p_request_id;

  -- ── 5. 同名学校の ow_user_educations.school_id を一括更新 ────────────────
  --    school テキストが完全一致 かつ school_id が未設定の行を対象
  UPDATE ow_user_educations
  SET    school_id = v_new_school_id
  WHERE  school    = v_request.school_name
    AND  school_id IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- ── 6. 結果を返す ─────────────────────────────────────────────────────────
  RETURN QUERY
    SELECT v_new_school_id AS school_id, v_updated_count AS updated_educations_count;
END;
$$;

-- 関数実行権限: authenticated ユーザーは呼び出し不可
--   (SECURITY DEFINER なので実行者権限ではなく関数定義者権限で動く)
--   ただし API Route 経由の service role クライアントからのみ呼び出す想定
REVOKE ALL ON FUNCTION approve_school_request(uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION approve_school_request(uuid, text, text, uuid) FROM authenticated;
