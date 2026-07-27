-- ============================================================================
-- Migration 060: Enable RLS and create policies for Phase ν conversation tables
-- ============================================================================
-- Purpose: Phase ν の対話基盤 4 テーブルに Row Level Security を設定する。
--
-- 本セッションで確定した RLS 思想:
-- - RLS-1-B (寛容): 離脱者も過去メッセージは読める。送信は participants のみ。
-- - RLS-2-B (運用優先): admin は全対話 SELECT 可、送信は participants のみ。
-- - RLS-3-B (担当者のみ): 企業 admin は明示的に participant 追加された人のみ。
--
-- 設計選択:
-- - A-3: Phase ν 新規 4 テーブル (conversations, participants, messages, reads)
--   既存テーブル (casual_meetings 等) の RLS は別 Phase で見直し
-- - B-1 寄り: helper function なし、各ポリシーで EXISTS 直書き
--   = 「何が許可されているか」が一目で分かる、後から関数化は容易
-- - D-3 (最低限テスト): RLS が ENABLE されているかのみ確認、UI 実装後に本格テスト
--
-- 関連設計参照:
-- - 引き継ぎ書 v10 §4
-- - 学び 70: 運用優先 (履歴保持、admin の運用支援)
-- ============================================================================

-- ============================================================================
-- 1. ow_conversations の RLS
-- ============================================================================

ALTER TABLE ow_conversations ENABLE ROW LEVEL SECURITY;

-- SELECT: 過去/現在の participant、または admin
-- (RLS-1-B 寛容 + RLS-2-B 運用優先)
CREATE POLICY "ow_conversations_select" ON ow_conversations 
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants
    WHERE conversation_id = ow_conversations.id
      AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- INSERT: 候補者本人 or admin
-- 企業側からの自発的対話作成は不可(スカウト型を排除する Opinio 思想)
CREATE POLICY "ow_conversations_insert" ON ow_conversations 
FOR INSERT
WITH CHECK (
  candidate_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- UPDATE: 自分が active participant、または admin
-- (last_message_at の更新、status の archived 等)
CREATE POLICY "ow_conversations_update" ON ow_conversations 
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants
    WHERE conversation_id = ow_conversations.id
      AND user_id = auth.uid()
      AND left_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================================
-- 2. ow_conversation_participants の RLS
-- ============================================================================

ALTER TABLE ow_conversation_participants ENABLE ROW LEVEL SECURITY;

-- SELECT: 同じ対話の参加者(過去/現在)、または admin
CREATE POLICY "ow_conversation_participants_select" ON ow_conversation_participants 
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants AS self
    WHERE self.conversation_id = ow_conversation_participants.conversation_id
      AND self.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- INSERT: アクティブな participant が新規参加者を追加、または admin
-- (RLS-3-B: 既存参加者だけが新参加者を呼べる)
CREATE POLICY "ow_conversation_participants_insert" ON ow_conversation_participants 
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants AS existing
    WHERE existing.conversation_id = ow_conversation_participants.conversation_id
      AND existing.user_id = auth.uid()
      AND existing.left_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- UPDATE: 自分自身の participant 行、または admin
-- (主に left_at セット = 離脱)
CREATE POLICY "ow_conversation_participants_update" ON ow_conversation_participants 
FOR UPDATE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================================
-- 3. ow_conversation_messages の RLS
-- ============================================================================

ALTER TABLE ow_conversation_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: 過去/現在の participant、または admin
-- (RLS-1-B: 離脱者も過去メッセージは読める)
CREATE POLICY "ow_conversation_messages_select" ON ow_conversation_messages 
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants
    WHERE conversation_id = ow_conversation_messages.conversation_id
      AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- INSERT: アクティブな participant のみ(admin 特権なし)
-- 自分が sender_participant_id である participant の対話にしか送信できない
-- (RLS-1-B/RLS-2-B: 送信は active participant に限定、admin の特権 SELECT のみ)
CREATE POLICY "ow_conversation_messages_insert" ON ow_conversation_messages 
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants
    WHERE id = ow_conversation_messages.sender_participant_id
      AND user_id = auth.uid()
      AND conversation_id = ow_conversation_messages.conversation_id
      AND left_at IS NULL
  )
);

-- UPDATE: メッセージの編集・論理削除
-- 送信者本人(active participant)、または admin (運営支援用、削除のみ想定)
CREATE POLICY "ow_conversation_messages_update" ON ow_conversation_messages 
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants
    WHERE id = ow_conversation_messages.sender_participant_id
      AND user_id = auth.uid()
      AND left_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================================
-- 4. ow_message_reads の RLS
-- ============================================================================

ALTER TABLE ow_message_reads ENABLE ROW LEVEL SECURITY;

-- SELECT: 自分の既読情報、または admin
-- 「自分が既読にしたメッセージ」は自分で見られる
CREATE POLICY "ow_message_reads_select" ON ow_message_reads 
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants
    WHERE id = ow_message_reads.participant_id
      AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- INSERT: 自分の participant 経由のみ
-- 「自分が既読にする」操作のみ可能、他人の既読を作れない
CREATE POLICY "ow_message_reads_insert" ON ow_message_reads 
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants
    WHERE id = ow_message_reads.participant_id
      AND user_id = auth.uid()
      AND left_at IS NULL
  )
);

-- DELETE: なし(既読は取り消せない設計、本セッションで確定)
-- メッセージや participant が削除されたら CASCADE で消える

-- ============================================================================
-- 確認: RLS が正しく ENABLE されているか
-- ============================================================================

-- 以下のクエリで確認可能:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
--   AND tablename IN (
--     'ow_conversations', 
--     'ow_conversation_participants', 
--     'ow_conversation_messages', 
--     'ow_message_reads'
--   );
-- 期待: rowsecurity = true (4 行)

-- SELECT tablename, policyname, cmd 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
--   AND tablename IN (
--     'ow_conversations', 
--     'ow_conversation_participants', 
--     'ow_conversation_messages', 
--     'ow_message_reads'
--   )
-- ORDER BY tablename, policyname;
-- 期待: 11 行のポリシー (各テーブル: SELECT/INSERT/UPDATE 等)
