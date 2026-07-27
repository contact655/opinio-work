-- migration 072: Fix ow_conversations UPDATE RLS auth.uid() mismatch
--
-- Issue: ow_conversation_participants.user_id (ow_users.id, app-level UUID)
--        was compared directly with auth.uid() (auth.users.id, Auth-level UUID).
--        These are different UUID spaces → UPDATE always failed for regular users.
--
-- Fix: Use the same pattern as migration 070 INSERT RLS fix:
--      resolve ow_users.id via auth_id subquery.
--
-- New conditions:
--   Condition A: candidate_user_id (direct column) resolves via ow_users.auth_id
--   Condition B: participant's user_id resolves via ow_users.auth_id (left_at IS NULL)
--   Condition C: admin role (unchanged)
--
-- Date: 2026-05-08

BEGIN;

DROP POLICY IF EXISTS "ow_conversations_update" ON ow_conversations;

CREATE POLICY "ow_conversations_update"
ON ow_conversations FOR UPDATE
USING (
  -- 条件 A: 候補者自身 (candidate_user_id → ow_users.auth_id 経由)
  candidate_user_id IN (
    SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
  )
  -- 条件 B: participant として登録済みの担当者 (user_id → ow_users.auth_id 経由)
  OR EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = ow_conversations.id
      AND p.user_id IN (
        SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
      )
      AND p.left_at IS NULL
  )
  -- 条件 C: admin (変更なし)
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid()
      AND ow_user_roles.role = 'admin'
  )
);

COMMIT;
