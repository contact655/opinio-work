-- ============================================================================
-- Migration 058: Create ow_message_reads
-- ============================================================================
-- Purpose: メッセージの既読管理を行うテーブル。
--
-- 本セッションで確定した設計判断:
-- - 058-A: メッセージレベル既読(LINE 流) - 各メッセージごとに既読を記録
--   (Slack のカーソル方式ではなく、対話の透明性を重視)
-- - 058-B: インデックス追加なし(YAGNI 原則)
--   PK の暗黙インデックスで主要クエリは高速、必要になったら後から追加
-- - 058-C: ON DELETE CASCADE 維持(participant は物理削除されない設計)
-- - 058-D: 既読の取り消し(unread)機能なし
--   求人プラットフォームで unread は過剰、必要なら将来追加
--
-- 関連設計参照:
-- - 引き継ぎ書 v10 §3-1
-- - 学び 70: 運用優先(ただし、既読管理は CASCADE が自然)
--
-- 主要なクエリパターン:
-- - ① 未読バッジ: LEFT JOIN ow_message_reads ON ... WHERE r.message_id IS NULL
-- - ② 既読/未読マーク: LEFT JOIN で各メッセージの既読有無を判定
-- - ③ 既読登録: INSERT ... ON CONFLICT (message_id, participant_id) DO NOTHING
-- - ④ メッセージの既読者: SELECT ... WHERE message_id = ?
--
-- すべて PK インデックス (message_id, participant_id) でカバーされる。
-- ============================================================================

CREATE TABLE ow_message_reads (
  message_id UUID NOT NULL 
    REFERENCES ow_conversation_messages(id) ON DELETE CASCADE,

  participant_id UUID NOT NULL 
    REFERENCES ow_conversation_participants(id) ON DELETE CASCADE,

  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (message_id, participant_id)
);

-- ============================================================================
-- コメント
-- ============================================================================

COMMENT ON TABLE ow_message_reads IS
  'メッセージの既読管理。メッセージレベル既読(LINE 流)、各 (message, participant) ペアで 1 行。Phase ν-1 で導入。';

COMMENT ON COLUMN ow_message_reads.message_id IS
  '既読対象のメッセージ。メッセージ削除時は CASCADE。';

COMMENT ON COLUMN ow_message_reads.participant_id IS
  '既読を行った participant。participant 削除時は CASCADE(participant は通常物理削除されないので影響軽微)。';

COMMENT ON COLUMN ow_message_reads.read_at IS
  '既読時刻。INSERT 時に NOW() でセット、UPDATE は想定しない。';

-- ============================================================================
-- インデックス
-- ============================================================================
-- 追加インデックスなし(YAGNI、本セッションで確定)
-- PK (message_id, participant_id) で主要クエリは高速にカバーされる
-- 必要になったら後から CREATE INDEX CONCURRENTLY で追加可能

-- ============================================================================
-- RLS は migration 060 で設定
-- ============================================================================
