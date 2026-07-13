-- Migration 222: fix missing participant records for existing DM conversations
-- ow_conversation_participants が空の direct_message 会話に参加者を追加する

INSERT INTO ow_conversation_participants (conversation_id, user_id, role)
SELECT c.id, c.candidate_user_id, 'initiator'
FROM ow_conversations c
WHERE c.kind = 'direct_message'
  AND NOT EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = c.id AND p.user_id = c.candidate_user_id
  )
  AND c.candidate_user_id IS NOT NULL;

INSERT INTO ow_conversation_participants (conversation_id, user_id, role)
SELECT c.id, c.mentor_user_id, 'recipient'
FROM ow_conversations c
WHERE c.kind = 'direct_message'
  AND NOT EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = c.id AND p.user_id = c.mentor_user_id
  )
  AND c.mentor_user_id IS NOT NULL;
