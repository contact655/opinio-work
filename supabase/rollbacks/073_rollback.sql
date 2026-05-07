-- Rollback: migration 073 を取り消し
-- (last_message_at 自動更新が無効になるため、本当に必要なときのみ実行)

BEGIN;

DROP TRIGGER IF EXISTS trg_update_last_message_at ON ow_conversation_messages;
DROP FUNCTION IF EXISTS ow_conversation_messages_update_last_message_at();

COMMIT;
