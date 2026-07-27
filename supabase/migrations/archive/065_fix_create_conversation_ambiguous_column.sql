-- =============================================================================
-- Migration 065: create_conversation RPC の列参照曖昧解消
-- =============================================================================
-- 背景:
--   migration 063 で作成した create_conversation() RPC で、
--   `column reference "conversation_id" is ambiguous (code: 42702)` エラーが
--   発生していた。
--
--   原因: RETURNS TABLE(conversation_id UUID, created BOOLEAN) で定義された
--   出力カラム名 conversation_id と、関数本体の EXISTS チェック内の
--   ow_conversation_participants.conversation_id の名前衝突。
--   PostgreSQL がどちらの conversation_id を参照すべきか判別できずエラー。
--
--   Step 1-5 動作確認のシナリオ 1(applications)とシナリオ 5(casual-meetings)で発覚。
--
-- 修正方針:
--   ow_conversation_participants にテーブル別名 `p` を付けて、
--   p.conversation_id と明示することで衝突解消。
--
--   関数の戻り値構造・引数・呼び出し側コード(createConversation.ts)に変更なし。
--   CREATE OR REPLACE FUNCTION で関数本体のみ置き換え。
--
-- 影響範囲:
--   create_conversation RPC のみ。呼び出し側 API ハンドラ
--   (/api/applications, /api/casual-meetings)は変更不要。
-- =============================================================================

BEGIN;

-- ============================================================
-- create_conversation を CREATE OR REPLACE で上書き
-- 修正箇所: ステップ 5 の EXISTS チェックにテーブル別名 p を追加
-- ============================================================
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
  -- 再認証チェック
  IF NOT EXISTS (
    SELECT 1 FROM ow_users
    WHERE id = p_candidate_user_id
      AND auth_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized: candidate_user_id does not match auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  -- 引数整合性チェック
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

  -- stage を kind から自動決定
  v_stage := CASE p_kind
    WHEN 'company' THEN 'active'
    WHEN 'mentor'  THEN 'mediated'
  END;

  -- ow_conversations への INSERT (ON CONFLICT DO NOTHING)
  INSERT INTO ow_conversations (
    kind, stage, company_id, mentor_user_id, candidate_user_id
  ) VALUES (
    p_kind, v_stage, p_company_id, p_mentor_user_id, p_candidate_user_id
  )
  ON CONFLICT (kind, company_id, mentor_user_id, candidate_user_id) DO NOTHING
  RETURNING id INTO v_conversation_id;

  -- 既存対話あり(ON CONFLICT 発火)の場合、SELECT で取得
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
  -- 修正箇所: テーブル別名 p を追加して列参照を明確化
  -- ============================================================
  IF NOT EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = v_conversation_id
      AND p.user_id = p_candidate_user_id
      AND p.left_at IS NULL
  ) THEN
    INSERT INTO ow_conversation_participants (conversation_id, user_id, role)
    VALUES (v_conversation_id, p_candidate_user_id, 'candidate');
  END IF;

  RETURN QUERY SELECT v_conversation_id, v_created;
END;
$$;

-- ============================================================
-- 権限設定(CREATE OR REPLACE で失われる可能性があるため再付与)
-- ============================================================
REVOKE ALL ON FUNCTION create_conversation(text, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_conversation(text, UUID, UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION create_conversation(text, UUID, UUID, UUID) TO authenticated;

-- ============================================================
-- コメント更新(migration 065 の言及を追加)
-- ============================================================
COMMENT ON FUNCTION create_conversation(text, UUID, UUID, UUID) IS
  'Phase ν-3 Step 1: 求職者の応募/カジュアル面談時に対話を生成する RPC。'
  'SECURITY DEFINER で RLS バイパス、関数内で auth.uid() 再認証実施。'
  'Phase ν-5 で kind=mentor の呼び出しが追加される予定。'
  '§4-8: ow_conversation_participants の RLS 根本修正は Phase ν-3 Step 3 で実施。'
  'migration 065: ow_conversation_participants にテーブル別名 p を追加して列参照曖昧解消。';

-- ============================================================
-- 学び 75: schema_migrations への記録
-- ============================================================
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('065', 'fix_create_conversation_ambiguous_column', NULL)
ON CONFLICT (version) DO NOTHING;

COMMIT;
