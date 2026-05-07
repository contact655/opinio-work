-- Rollback: migration 072 の取り消し
-- 072 適用後 → 071 適用後の状態（壊れた UPDATE RLS）に戻す
-- ⚠️ user_id = auth.uid() の UUID 不一致バグが復活するため、本当に必要なときのみ実行

BEGIN;

DROP POLICY IF EXISTS "ow_conversations_update" ON ow_conversations;

-- migration 072 適用前の状態（壊れた UPDATE ポリシー）に戻す
-- ⚠️ p.user_id = auth.uid() は UUID 空間が異なるため常に FALSE（非 admin ユーザー）
CREATE POLICY "ow_conversations_update"
ON ow_conversations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = ow_conversations.id
      AND p.user_id = auth.uid()   -- ← UUID 不一致バグ（intentionally restored）
      AND p.left_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid()
      AND ow_user_roles.role = 'admin'
  )
);

COMMIT;
