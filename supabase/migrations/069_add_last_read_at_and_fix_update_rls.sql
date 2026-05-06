-- =====================================================
-- Migration 069: last_read_at カラム追加 + UPDATE RLS 修正
-- =====================================================
-- Phase ν-3 Step 4-1
-- 目的: ow_conversation_participants に既読管理用カラムを追加し、
--       既存 UPDATE ポリシーの型不一致バグを修正する
--
-- 背景:
--   - 既存 UPDATE ポリシーは `user_id = auth.uid()` を使用しており、
--     ow_users.id (uuid) と auth.uid() (uuid だが auth.users 由来) の
--     型不一致により常に false → 全件 RLS 違反になる
--   - 発見 λ/ν と同一パターン
--   - 正しい比較: user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- Section 1: last_read_at カラム追加
-- -----------------------------------------------------
-- nullable で OK(NULL = 一度も既読にしていない状態)
ALTER TABLE ow_conversation_participants
ADD COLUMN last_read_at timestamptz;

COMMENT ON COLUMN ow_conversation_participants.last_read_at IS
  '最後にこの会話を既読にした日時。NULL = 一度も既読にしていない。B 画面アクセス時に now() で更新される。';

-- -----------------------------------------------------
-- Section 2: UPDATE ポリシー修正
-- (旧: user_id = auth.uid() は型不一致で常に false)
-- (新: ow_users.auth_id 経由の正しいパターン)
-- -----------------------------------------------------
DROP POLICY IF EXISTS ow_conversation_participants_update ON ow_conversation_participants;

CREATE POLICY ow_conversation_participants_update
ON ow_conversation_participants
FOR UPDATE
USING (
  user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid()
      AND ow_user_roles.role = 'admin'
  )
)
WITH CHECK (
  user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid()
      AND ow_user_roles.role = 'admin'
  )
);

-- ============================================================
-- 学び 75: schema_migrations への記録
-- ============================================================
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('069', 'add_last_read_at_and_fix_update_rls', NULL)
ON CONFLICT (version) DO NOTHING;

COMMIT;
