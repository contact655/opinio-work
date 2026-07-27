-- migration 073: Auto-update ow_conversations.last_message_at via AFTER INSERT trigger
-- Issue: ow_conversations UPDATE RLS chain causes silent 0-row update
--        when called from API context (RLS sub-references create complex eval)
-- Fix: Use AFTER INSERT trigger on ow_conversation_messages with SECURITY DEFINER
--      to bypass RLS entirely for the auto-update
-- Date: 2026-05-08

BEGIN;

-- トリガー関数: AFTER INSERT で last_message_at を更新
CREATE OR REPLACE FUNCTION ow_conversation_messages_update_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- last_message_at < NEW.sent_at の場合のみ更新(冪等性 + 古いメッセージ INSERT 時の保護)
  UPDATE ow_conversations
  SET last_message_at = NEW.sent_at
  WHERE id = NEW.conversation_id
    AND (last_message_at IS NULL OR last_message_at < NEW.sent_at);

  RETURN NEW;
END;
$$;

-- トリガー設置
DROP TRIGGER IF EXISTS trg_update_last_message_at ON ow_conversation_messages;

CREATE TRIGGER trg_update_last_message_at
AFTER INSERT ON ow_conversation_messages
FOR EACH ROW
EXECUTE FUNCTION ow_conversation_messages_update_last_message_at();

COMMIT;
