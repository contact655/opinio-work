-- ============================================================================
-- Migration 059: Add conversation_id to existing tables
-- ============================================================================
-- Purpose: 既存テーブル (ow_casual_meetings, ow_job_applications,
--          ow_mentor_reservations) に conversation_id カラムを追加し、
--          Phase ν の対話基盤に紐づけられるようにする。
--
-- 設計判断 (本セッション確定):
-- - NULLABLE: 既存データ 0 件、将来 conversation 未紐付けケースに対応
-- - ON DELETE SET NULL: conversation 削除されても申込履歴は資産として残す
--   (学び 70: 運用優先、履歴保持)
-- - 部分インデックス WHERE conversation_id IS NOT NULL:
--   ν-3 以降の UI クエリ高速化、NULL 行を除外して効率化
--
-- 対象外:
-- - ow_consultation_bookings: 本セッションで「DB に存在しない」と確認、廃止済み
--
-- 関連設計参照:
-- - 引き継ぎ書 v10 §3-2
-- - 学び 70: 運用優先 (履歴保持)
-- ============================================================================

-- ow_casual_meetings に conversation_id を追加
ALTER TABLE ow_casual_meetings
  ADD COLUMN conversation_id UUID
  REFERENCES ow_conversations(id) ON DELETE SET NULL;

CREATE INDEX idx_ow_casual_meetings_conversation_id
  ON ow_casual_meetings (conversation_id)
  WHERE conversation_id IS NOT NULL;

COMMENT ON COLUMN ow_casual_meetings.conversation_id IS
  '紐づく対話への参照 (Phase ν-1 で追加)。NULL = 対話未紐付け、まだ会話が始まっていない予約。';

-- ow_job_applications に conversation_id を追加
ALTER TABLE ow_job_applications
  ADD COLUMN conversation_id UUID
  REFERENCES ow_conversations(id) ON DELETE SET NULL;

CREATE INDEX idx_ow_job_applications_conversation_id
  ON ow_job_applications (conversation_id)
  WHERE conversation_id IS NOT NULL;

COMMENT ON COLUMN ow_job_applications.conversation_id IS
  '紐づく対話への参照 (Phase ν-1 で追加)。NULL = 対話未紐付け。';

-- ow_mentor_reservations に conversation_id を追加
ALTER TABLE ow_mentor_reservations
  ADD COLUMN conversation_id UUID
  REFERENCES ow_conversations(id) ON DELETE SET NULL;

CREATE INDEX idx_ow_mentor_reservations_conversation_id
  ON ow_mentor_reservations (conversation_id)
  WHERE conversation_id IS NOT NULL;

COMMENT ON COLUMN ow_mentor_reservations.conversation_id IS
  '紐づく対話への参照 (Phase ν-1 で追加)。NULL = 対話未紐付け、運営者仲介を待っている状態など。';
