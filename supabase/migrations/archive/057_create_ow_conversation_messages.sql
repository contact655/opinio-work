-- ============================================================================
-- Migration 057: Create ow_conversation_messages
-- ============================================================================
-- Purpose: 対話のメッセージ本体を管理するテーブル。
--
-- 本セッションで確定した設計判断:
-- - 057-A: sender_participant_id ON DELETE SET NULL
--   (participant 退会してもメッセージは履歴として残る)
-- - 057-B: body の制約 = 空文字列禁止 + 上限 8000 文字
-- - 057-C: 編集ありで履歴保持 (LINE/Slack 流)
--   案 1: 最小限実装 (edited_at + deleted_at のみ)
--   = UI 上は「編集済み」マーカー、削除は論理削除
--   = 編集前の本文は復元できないが、Opinio の「LINE/Slack 体験」を満たす
--   = 将来「編集前を見たい」ニーズが出れば、案 2/3 に拡張可能
--
-- 関連設計参照:
-- - 引き継ぎ書 v10 §3-1
-- - 学び 70: 運用優先 (履歴保持、論理削除)
-- - migration 056 の SET NULL 思想と整合
-- ============================================================================

CREATE TABLE ow_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 対話への参照 (対話削除時はメッセージも削除)
  conversation_id UUID NOT NULL REFERENCES ow_conversations(id) ON DELETE CASCADE,

  -- 送信者 (participant 退会してもメッセージは残る、学び 70)
  -- NULL = 退会済み participant が送ったメッセージ
  sender_participant_id UUID REFERENCES ow_conversation_participants(id) ON DELETE SET NULL,

  -- メッセージ本文
  -- 制約: 空文字列禁止 + 上限 8000 文字
  body TEXT NOT NULL,

  -- 初回送信時刻
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 編集時刻 (NULL = 未編集)
  -- LINE/Slack 流: 編集すると body が上書きされ、edited_at が記録される
  edited_at TIMESTAMPTZ,

  -- 削除時刻 (NULL = アクティブ、NOT NULL = 論理削除済み)
  -- 学び 70 (運用優先): 物理削除せず履歴として保持
  deleted_at TIMESTAMPTZ,

  -- body の制約: 空文字列禁止 + 上限 8000 文字
  CONSTRAINT ow_conversation_messages_body_length CHECK (
    length(body) >= 1 AND length(body) <= 8000
  ),

  -- edited_at は sent_at より後でなければならない
  CONSTRAINT ow_conversation_messages_edited_after_sent CHECK (
    edited_at IS NULL OR edited_at >= sent_at
  ),

  -- deleted_at は sent_at より後でなければならない
  CONSTRAINT ow_conversation_messages_deleted_after_sent CHECK (
    deleted_at IS NULL OR deleted_at >= sent_at
  )
);

-- ============================================================================
-- インデックス
-- ============================================================================

-- 対話詳細画面で「対話 X のメッセージを時系列で取得」を高速化
-- WHERE conversation_id = $1 AND deleted_at IS NULL ORDER BY sent_at
CREATE INDEX idx_ow_conversation_messages_conversation_sent
  ON ow_conversation_messages (conversation_id, sent_at)
  WHERE deleted_at IS NULL;

-- 削除済みも含めて取得する場合(運営者が監査する時など)
CREATE INDEX idx_ow_conversation_messages_conversation_all
  ON ow_conversation_messages (conversation_id, sent_at);

-- 送信者別のメッセージ取得(統計・分析用)
CREATE INDEX idx_ow_conversation_messages_sender
  ON ow_conversation_messages (sender_participant_id, sent_at)
  WHERE sender_participant_id IS NOT NULL;

-- ============================================================================
-- コメント
-- ============================================================================

COMMENT ON TABLE ow_conversation_messages IS
  '対話のメッセージ本体。LINE/Slack 流の編集機能(edited_at)と論理削除(deleted_at)を持つ。Phase ν-1 で導入。';

COMMENT ON COLUMN ow_conversation_messages.sender_participant_id IS
  '送信者の participant id。participant 退会時は SET NULL される(履歴保持、学び 70)。NULL = 退会済み participant が送ったメッセージ。';

COMMENT ON COLUMN ow_conversation_messages.body IS
  'メッセージ本文。空文字列禁止、上限 8000 文字。編集時は上書き(履歴保持なし、LINE/Slack 流)。';

COMMENT ON COLUMN ow_conversation_messages.sent_at IS
  '初回送信時刻。編集後も変更されない(編集時刻は edited_at で記録)。';

COMMENT ON COLUMN ow_conversation_messages.edited_at IS
  '最後に編集した時刻。NULL = 未編集。NOT NULL = 編集済み(UI で「編集済み」マーカー表示)。';

COMMENT ON COLUMN ow_conversation_messages.deleted_at IS
  '論理削除時刻。NULL = アクティブ。NOT NULL = 削除済み(UI 上は「メッセージが削除されました」表示、運営者は body を見られる)。';

-- ============================================================================
-- RLS は migration 060 で設定 (本 migration ではテーブル作成のみ)
-- ============================================================================
