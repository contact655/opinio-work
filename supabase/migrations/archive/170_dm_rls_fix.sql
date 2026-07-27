-- Migration 170: DM support — fix ow_conversations SELECT policy
-- so that mentor_user_id (DM recipient) can also read the conversation

DROP POLICY IF EXISTS ow_conversations_select ON ow_conversations;

CREATE POLICY ow_conversations_select ON ow_conversations
  FOR SELECT USING (
    -- jobseeker (sender / candidate)
    candidate_user_id IN (
      SELECT id FROM ow_users WHERE auth_id = auth.uid()
    )
    OR
    -- DM recipient (stored in mentor_user_id for kind='direct_message')
    mentor_user_id IN (
      SELECT id FROM ow_users WHERE auth_id = auth.uid()
    )
    OR
    -- company admin
    (company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM ow_company_admins ca
      JOIN ow_users u ON u.id = ca.user_id
      WHERE ca.company_id = ow_conversations.company_id
        AND u.auth_id = auth.uid()
        AND ca.is_active = true
    ))
    OR
    -- platform admin
    EXISTS (
      SELECT 1 FROM ow_user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
