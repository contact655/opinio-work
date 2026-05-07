-- =============================================================================
-- Rollback: Migration 070 の取り消し
-- =============================================================================
-- 実行前確認: migration 070 が適用済みであること
-- 実行後: migration 069 適用後の状態に戻る
-- =============================================================================

BEGIN;

-- =============================================================================
-- Section 1 ロールバック: ow_conversation_participants INSERT を migration 060 の旧ポリシーに戻す
-- =============================================================================
DROP POLICY IF EXISTS "ow_conversation_participants_insert" ON ow_conversation_participants;

CREATE POLICY "ow_conversation_participants_insert"
ON ow_conversation_participants
FOR INSERT
WITH CHECK (
  -- 旧パターン (auth.uid() 直接比較 — UUID 空間不一致で常に false だった旧実装)
  EXISTS (
    SELECT 1 FROM ow_conversation_participants existing
    WHERE existing.conversation_id = ow_conversation_participants.conversation_id
      AND existing.user_id = auth.uid()
      AND existing.left_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- =============================================================================
-- Section 2 ロールバック: ow_conversations SELECT を migration 066/067 の状態に戻す
-- =============================================================================
DROP POLICY IF EXISTS "ow_conversations_select" ON ow_conversations;

CREATE POLICY "ow_conversations_select"
ON ow_conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = ow_conversations.id
      AND p.user_id IN (
        SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
      )
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- =============================================================================
-- Section 3 ロールバック: ow_conversation_participants SELECT を migration 067 の状態に戻す
-- =============================================================================
DROP POLICY IF EXISTS "ow_conversation_participants_select" ON ow_conversation_participants;

CREATE POLICY "ow_conversation_participants_select"
ON ow_conversation_participants
FOR SELECT
USING (
  user_id IN (
    SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- schema_migrations レコードを削除
DELETE FROM supabase_migrations.schema_migrations WHERE version = '070';

COMMIT;
