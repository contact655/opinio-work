-- Rollback: migration 074 を取り消し
-- 074 適用後 → 073 適用後の状態（無限再帰バグあり）に戻す
-- ⚠️ WITH CHECK 条件 1 の自己参照バグが復活するため、本当に必要なときのみ実行
--    INSERT 操作（参加ボタン）が "infinite recursion" エラーになる

BEGIN;

DROP POLICY IF EXISTS "ow_conversation_participants_insert" ON ow_conversation_participants;

-- migration 074 適用前の状態（自己参照バグあり）に戻す
-- ⚠️ 条件 1 の FROM ow_conversation_participants existing は intentionally restored
CREATE POLICY "ow_conversation_participants_insert"
ON ow_conversation_participants FOR INSERT
WITH CHECK (
  -- 条件 1: 自己参照（無限再帰の原因、intentionally restored）
  EXISTS (
    SELECT 1
    FROM ow_conversation_participants existing
    JOIN ow_users u ON (u.id = existing.user_id)
    WHERE existing.conversation_id = ow_conversation_participants.conversation_id
      AND u.auth_id = auth.uid()
      AND existing.left_at IS NULL
  )
  -- 条件 2: 会社管理者
  OR EXISTS (
    SELECT 1
    FROM ow_company_admins ca
    JOIN ow_users u ON (u.id = ca.user_id)
    JOIN ow_conversations c ON (c.company_id = ca.company_id)
    WHERE c.id = ow_conversation_participants.conversation_id
      AND u.auth_id = auth.uid()
      AND ca.is_active = true
  )
  -- 条件 3: admin
  OR EXISTS (
    SELECT 1
    FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid()
      AND ow_user_roles.role = 'admin'
  )
);

COMMIT;
