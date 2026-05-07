-- Rollback: Migration 071 の取り消し
-- 071 適用後 → 070 適用後の状態に戻す
-- (これにより無限再帰バグが復活するため、本当に必要なときのみ実行)

BEGIN;

DROP POLICY IF EXISTS "ow_conversations_select" ON ow_conversations;

-- migration 070 の Condition A(participant 参照)に戻す
CREATE POLICY "ow_conversations_select"
ON ow_conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = ow_conversations.id
      AND p.user_id IN (
        SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
      )
  )
  OR (
    ow_conversations.company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM ow_company_admins ca
      JOIN ow_users u ON u.id = ca.user_id
      WHERE ca.company_id = ow_conversations.company_id
        AND u.auth_id = auth.uid()
        AND ca.is_active = true
    )
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

COMMIT;
