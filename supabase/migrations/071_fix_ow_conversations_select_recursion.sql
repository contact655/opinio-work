-- migration 071: Fix infinite recursion in ow_conversations SELECT policy
-- Related: docs/planning/phase-nu-4-recursion-bug-diagnosis.md
-- Issue: migration 070 created circular reference between
--   ow_conversations_select <-> ow_conversation_participants_select
-- Fix: Replace participant lookup with direct candidate_user_id comparison
-- Date: 2026-05-07

BEGIN;

DROP POLICY IF EXISTS "ow_conversations_select" ON ow_conversations;

CREATE POLICY "ow_conversations_select"
ON ow_conversations FOR SELECT
USING (
  -- Condition A (FIXED): candidate self-access via candidate_user_id
  -- (replaces ow_conversation_participants lookup that caused recursion)
  candidate_user_id IN (
    SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
  )
  -- Condition B (unchanged): same-company HR via ow_company_admins
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
  -- Condition C (unchanged): admin
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

COMMIT;
