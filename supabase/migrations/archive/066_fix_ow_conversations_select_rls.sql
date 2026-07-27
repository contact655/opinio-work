-- =============================================================================
-- Migration 066: ow_conversations / ow_conversation_participants SELECT RLS 修正
-- =============================================================================
-- 背景:
--   ow_conversations と ow_conversation_participants の SELECT RLS ポリシーが
--   `user_id = auth.uid()` (auth.users UUID) で直接比較しているが、
--   user_id カラムには ow_users.id (アプリ内 UUID) が格納されているため
--   常に 0 件が返る。
--
--   migration 064 (ow_job_applications RLS 修正) と完全に同一のパターン。
--   Step 2-2 の A 画面(対話一覧)実装前に修正が必要なため Step 2 に前倒し。
--
-- 修正方針:
--   ow_casual_meetings_seeker_read と同じパターン
--   `user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())` に統一。
--
-- 修正範囲(意図的に限定):
--   ✅ ow_conversations の SELECT ポリシー
--   ✅ ow_conversation_participants の SELECT ポリシー
--   ❌ INSERT ポリシー(§4-8、Phase ν-3 Step 3 で対処)
--   ❌ UPDATE ポリシー(影響範囲を最小化、Step 3 で合わせて検討)
--   ❌ admin / company_admins 系ポリシー(別ロジック、変更なし)
--
-- =============================================================================
-- 関連する未対応事項(Step 3 で対処予定):
--   - UPDATE ポリシーも同じ「user_id = auth.uid()」直接比較問題あり。
--     Step 3 で D(既読処理: ow_conversation_participants.last_read_at 更新)
--     実装時に migration 067 として対処予定。
--   - ow_conversation_participants の INSERT ポリシー(§4-8)も同パターン問題。
--     Step 3 で B 画面 lazy 登録実装時に対処予定。
--   - ow_conversation_messages の RLS は Step 3 でメッセージ送信機能 C 実装時に対処予定。
--
-- スコープ規律: 本 migration は Step 2-3 の A 画面(対話一覧)実装の前提条件
-- である SELECT のみに絞る。学び 71/72 のスコープ規律遵守。
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. ow_conversations SELECT ポリシー修正
-- 旧: ow_conversation_participants.user_id = auth.uid()
-- 新: ow_conversation_participants.user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
-- ============================================================
DROP POLICY IF EXISTS "ow_conversations_select" ON ow_conversations;

CREATE POLICY "ow_conversations_select"
ON ow_conversations
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = ow_conversations.id
      AND p.user_id IN (
        SELECT id FROM ow_users WHERE auth_id = auth.uid()
      )
  )
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE ow_user_roles.user_id = auth.uid()
      AND ow_user_roles.role = 'admin'
  )
);

-- ============================================================
-- 2. ow_conversation_participants SELECT ポリシー修正
-- 旧: self.user_id = auth.uid()
-- 新: self.user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
-- ============================================================
DROP POLICY IF EXISTS "ow_conversation_participants_select" ON ow_conversation_participants;

CREATE POLICY "ow_conversation_participants_select"
ON ow_conversation_participants
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants self
    WHERE self.conversation_id = ow_conversation_participants.conversation_id
      AND self.user_id IN (
        SELECT id FROM ow_users WHERE auth_id = auth.uid()
      )
  )
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
VALUES ('066', 'fix_ow_conversations_select_rls', NULL)
ON CONFLICT (version) DO NOTHING;

COMMIT;
