-- =============================================================================
-- Migration 063: create_conversation() RPC 関数の作成
-- =============================================================================
-- 背景:
--   Phase ν-3 Step 1(F: 対話生成トリガー)の実装。
--   求職者が求人応募・カジュアル面談申込を行った際に、
--   ow_conversations + ow_conversation_participants を原子的に生成する。
--
-- 設計判断:
--   Z-A: SECURITY DEFINER で RLS をバイパス
--     理由: ow_conversation_participants の INSERT RLS ポリシーが
--     「自分がすでに participant として存在すること」を条件としており、
--     初回 INSERT 時に自己矛盾で必ず拒否される(発見 β)。
--     API Route 側で resolveOwUserId() による認証を完了済みのため、
--     RPC 内では再認証チェックのみ実施し、RLS バイパスを許容する。
--
--   W1: participants は candidate のみ初期登録。
--     company_admin/mentor は lazy 登録(Phase ν-4/ν-5 で実施)。
--
--   T1: 1 トランザクションで ow_conversations + ow_conversation_participants
--     を原子的に INSERT。
--
--   P4: kind=mentor の呼び出しは Phase ν-5 で追加。本 Step では kind='company' のみ使用。
--
-- 発見 α 対応:
--   ow_conversation_participants に UNIQUE 制約なし(pg_constraint で確認済み)。
--   ON CONFLICT DO NOTHING ではなく EXISTS チェック → INSERT のパターンを採用。
--
-- 発見 β 宿題化:
--   §4-8: ow_conversation_participants の RLS 根本修正は Phase ν-3 Step 3 で実施予定。
--
-- セキュリティ対策:
--   1. SET search_path = public, pg_temp (search_path injection 防止)
--   2. 関数内で auth.uid() vs ow_users.auth_id の再認証チェック
--   3. REVOKE ALL FROM PUBLIC / anon
--   4. GRANT EXECUTE TO authenticated のみ
--
-- 学び 75: supabase_migrations.schema_migrations へ手動記録(statements=NULL)
-- 学び 76: SQL Editor の新規タブ or Cmd+A → Delete でクリア後に貼り付け
-- =============================================================================

BEGIN;

-- =============================================================================
-- RPC 関数: create_conversation
-- =============================================================================
CREATE OR REPLACE FUNCTION create_conversation(
  p_kind              text,
  p_candidate_user_id UUID,
  p_company_id        UUID DEFAULT NULL,
  p_mentor_user_id    UUID DEFAULT NULL
)
RETURNS TABLE(conversation_id UUID, created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conversation_id UUID;
  v_created         BOOLEAN;
  v_stage           text;
BEGIN
  -- ============================================================
  -- セキュリティ対策 2: 再認証チェック
  -- p_candidate_user_id が auth.uid() に対応する ow_users.id か確認
  -- SECURITY DEFINER 内でも auth.uid() は呼び出し元ユーザーの UID を返す
  -- ============================================================
  IF NOT EXISTS (
    SELECT 1 FROM ow_users
    WHERE id = p_candidate_user_id
      AND auth_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized: candidate_user_id does not match auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  -- ============================================================
  -- 引数整合性チェック
  -- ============================================================
  IF p_kind NOT IN ('company', 'mentor') THEN
    RAISE EXCEPTION 'invalid kind: %', p_kind USING ERRCODE = '22023';
  END IF;

  IF p_candidate_user_id IS NULL THEN
    RAISE EXCEPTION 'candidate_user_id must not be null' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'company' THEN
    IF p_company_id IS NULL THEN
      RAISE EXCEPTION 'company_id must be set when kind=company' USING ERRCODE = '22023';
    END IF;
    IF p_mentor_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'mentor_user_id must be null when kind=company' USING ERRCODE = '22023';
    END IF;
  ELSIF p_kind = 'mentor' THEN
    IF p_mentor_user_id IS NULL THEN
      RAISE EXCEPTION 'mentor_user_id must be set when kind=mentor' USING ERRCODE = '22023';
    END IF;
    IF p_company_id IS NOT NULL THEN
      RAISE EXCEPTION 'company_id must be null when kind=mentor' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- ============================================================
  -- stage を kind から自動決定
  -- (ow_conversations_stage_consistency CHECK 制約と整合)
  -- ============================================================
  v_stage := CASE p_kind
    WHEN 'company' THEN 'active'
    WHEN 'mentor'  THEN 'mediated'
  END;

  -- ============================================================
  -- ow_conversations への INSERT (ON CONFLICT DO NOTHING)
  -- UNIQUE NULLS NOT DISTINCT (kind, company_id, mentor_user_id, candidate_user_id)
  -- に対して競合した場合は何もしない → RETURNING は空 → v_conversation_id = NULL
  -- ============================================================
  INSERT INTO ow_conversations (
    kind, stage, company_id, mentor_user_id, candidate_user_id
  ) VALUES (
    p_kind, v_stage, p_company_id, p_mentor_user_id, p_candidate_user_id
  )
  ON CONFLICT (kind, company_id, mentor_user_id, candidate_user_id) DO NOTHING
  RETURNING id INTO v_conversation_id;

  -- ============================================================
  -- INSERT が空(既存対話あり)なら SELECT で取得
  -- IS NOT DISTINCT FROM で NULL を含む比較を正しく扱う
  -- ============================================================
  IF v_conversation_id IS NULL THEN
    SELECT id INTO v_conversation_id
    FROM ow_conversations
    WHERE kind = p_kind
      AND company_id IS NOT DISTINCT FROM p_company_id
      AND mentor_user_id IS NOT DISTINCT FROM p_mentor_user_id
      AND candidate_user_id = p_candidate_user_id;

    v_created := false;
  ELSE
    v_created := true;
  END IF;

  -- ============================================================
  -- candidate participant の存在確認 → なければ INSERT
  -- 発見 α 対応: UNIQUE 制約がないため EXISTS チェックで重複回避
  -- ============================================================
  IF NOT EXISTS (
    SELECT 1 FROM ow_conversation_participants
    WHERE conversation_id = v_conversation_id
      AND user_id = p_candidate_user_id
      AND left_at IS NULL
  ) THEN
    INSERT INTO ow_conversation_participants (conversation_id, user_id, role)
    VALUES (v_conversation_id, p_candidate_user_id, 'candidate');
  END IF;

  RETURN QUERY SELECT v_conversation_id, v_created;
END;
$$;

-- =============================================================================
-- セキュリティ対策 3/4: 権限設定
-- authenticated のみ EXECUTE 可、PUBLIC / anon には付与しない
-- =============================================================================
REVOKE ALL ON FUNCTION create_conversation(text, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_conversation(text, UUID, UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION create_conversation(text, UUID, UUID, UUID) TO authenticated;

-- =============================================================================
-- コメント(後続 Phase での参照用)
-- =============================================================================
COMMENT ON FUNCTION create_conversation(text, UUID, UUID, UUID) IS
  'Phase ν-3 Step 1: 求職者の応募/カジュアル面談時に対話を生成する RPC。'
  'SECURITY DEFINER で RLS バイパス、関数内で auth.uid() 再認証実施。'
  'Phase ν-5 で kind=mentor の呼び出しが追加される予定。'
  '§4-8: ow_conversation_participants の RLS 根本修正は Phase ν-3 Step 3 で実施。';

-- =============================================================================
-- 学び 75: supabase_migrations.schema_migrations への記録
-- =============================================================================
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('063', 'create_conversation_rpc', NULL)
ON CONFLICT (version) DO NOTHING;

COMMIT;
