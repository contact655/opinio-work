-- ============================================================================
-- Migration 056: Create ow_conversation_participants
-- ============================================================================
-- Purpose: 対話の参加者を動的に管理するテーブル。
--
-- Phase ν の中核設計原則:
-- - 「グローバルロール ≠ 対話内ロール」原則 (M-5)
--   = ow_user_roles と ow_conversation_participants.role は別物
-- - 動的参加モデル: 参加者は対話の途中で増減できる
-- - 多重ロール許容: 同一ユーザーが同一対話で複数の role を同時に持てる
--   例: 柴さんが editor + operator を同時に保持
-- - 履歴保持: 離脱した participant も削除せず left_at で記録
-- - 退会者の履歴も保持: user_id ON DELETE SET NULL
--   退会してもメッセージ送信履歴・参加履歴は対話に残る
--
-- 重複参加の制約設計 (本セッションで確定):
-- - 部分UNIQUE WHERE left_at IS NULL AND user_id IS NOT NULL を採用
-- - 同じ (conversation, user, role) でアクティブは 1 つだけ
-- - 離脱→再参加は新規 INSERT として履歴に残せる
-- - 役割が違えば同一ユーザーが複数アクティブを持てる
-- - user_id IS NULL (退会者) の行は UNIQUE 制約から外れる
--   = 退会者の履歴行が複数あっても整合性が保たれる
--
-- 関連設計参照:
-- - 引き継ぎ書 v10 §3-1
-- - 学び 69: グローバルロール ≠ 対話内ロール原則 (M-5)
-- - 学び 70: 運用優先 (履歴保持)
-- ============================================================================

CREATE TABLE ow_conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  conversation_id UUID NOT NULL REFERENCES ow_conversations(id) ON DELETE CASCADE,

  user_id UUID REFERENCES ow_users(id) ON DELETE SET NULL,

  role TEXT NOT NULL CHECK (role IN ('candidate', 'company_admin', 'mentor', 'editor', 'operator')),

  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  left_at TIMESTAMPTZ,

  CONSTRAINT ow_conversation_participants_left_after_joined CHECK (
    left_at IS NULL OR left_at >= joined_at
  )
);

-- ============================================================================
-- 部分UNIQUEインデックス: 同じ (conv, user, role) でアクティブは 1 つだけ
-- ============================================================================

CREATE UNIQUE INDEX ow_conversation_participants_active_unique
  ON ow_conversation_participants (conversation_id, user_id, role)
  WHERE left_at IS NULL AND user_id IS NOT NULL;

-- ============================================================================
-- インデックス
-- ============================================================================

CREATE INDEX idx_ow_conversation_participants_user_active
  ON ow_conversation_participants (user_id, conversation_id)
  WHERE left_at IS NULL AND user_id IS NOT NULL;

CREATE INDEX idx_ow_conversation_participants_conversation
  ON ow_conversation_participants (conversation_id, user_id);

-- ============================================================================
-- コメント
-- ============================================================================

COMMENT ON TABLE ow_conversation_participants IS
  '対話の参加者。動的参加モデルで、participant の追加・離脱を履歴として記録する。退会者(user_id IS NULL)の履歴も保持。Phase ν-1 で導入。';

COMMENT ON COLUMN ow_conversation_participants.user_id IS
  '参加者の user_id。退会時は NULL に SET される(履歴保持、学び 70)。NULL の行は退会済みユーザーを意味する。';

COMMENT ON COLUMN ow_conversation_participants.role IS
  '対話内ロール: candidate (求職者), company_admin (企業管理者), mentor (メンター), editor (編集部), operator (運営者・仲介役)。グローバルロールとは独立 (学び 69, M-5)。';

COMMENT ON COLUMN ow_conversation_participants.joined_at IS
  '参加開始時刻。再参加時は新規行が作られるので、その時の joined_at が記録される。';

COMMENT ON COLUMN ow_conversation_participants.left_at IS
  '離脱時刻。NULL = アクティブ参加中。NOT NULL = 過去に離脱した(履歴保持)。学び 70 (運用優先): 削除せず履歴として残す。';

-- ============================================================================
-- RLS は migration 060 で設定 (本 migration ではテーブル作成のみ)
-- ============================================================================
