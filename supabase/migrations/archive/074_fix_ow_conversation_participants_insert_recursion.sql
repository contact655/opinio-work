-- migration 074: Fix infinite recursion in ow_conversation_participants INSERT policy
--
-- Root cause: WITH CHECK condition 1 contained a direct self-reference:
--   EXISTS (SELECT 1 FROM ow_conversation_participants existing ...)
--   evaluating a policy on table T while reading from table T → infinite recursion
--
-- Fix: Remove condition 1 (self-referencing). Keep conditions 2 and 3.
--   Condition 2 (company admin check) is sufficient for the join flow.
--   Condition 1 ("existing participant can add others") is not used in any
--   current API endpoint and removing it makes the policy more restrictive.
--
-- WITH CHECK before (3 conditions):
--   条件 1: EXISTS (SELECT 1 FROM ow_conversation_participants existing ...)  ← REMOVED
--   条件 2: EXISTS (SELECT 1 FROM ow_company_admins ca
--             JOIN ow_users u ON u.id = ca.user_id
--             JOIN ow_conversations c ON c.company_id = ca.company_id
--             WHERE c.id = ow_conversation_participants.conversation_id
--               AND u.auth_id = auth.uid() AND ca.is_active = true)            ← KEPT
--   条件 3: EXISTS (SELECT 1 FROM ow_user_roles
--             WHERE user_id = auth.uid() AND role = 'admin')                   ← KEPT
--
-- WITH CHECK after (2 conditions): 条件 2 + 条件 3 のみ
--
-- Date: 2026-05-08

BEGIN;

DROP POLICY IF EXISTS "ow_conversation_participants_insert" ON ow_conversation_participants;

CREATE POLICY "ow_conversation_participants_insert"
ON ow_conversation_participants FOR INSERT
WITH CHECK (
  -- 条件 2: 会社管理者（同社の ow_company_admins に is_active = true で登録済み）
  EXISTS (
    SELECT 1
    FROM ow_company_admins ca
    JOIN ow_users u ON (u.id = ca.user_id)
    JOIN ow_conversations c ON (c.company_id = ca.company_id)
    WHERE c.id = ow_conversation_participants.conversation_id
      AND u.auth_id = auth.uid()
      AND ca.is_active = true
  )
  -- 条件 3: admin ロール（変更なし）
  OR EXISTS (
    SELECT 1
    FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid()
      AND ow_user_roles.role = 'admin'
  )
);

COMMIT;
