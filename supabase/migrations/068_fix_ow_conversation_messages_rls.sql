-- =============================================================================
-- Migration 068: ow_conversation_messages SELECT + INSERT RLS 修正
-- =============================================================================
-- 背景:
--   Phase ν-3 Step 3 開始前の事前確認(§4-11)で、ow_conversation_messages の
--   SELECT/INSERT/UPDATE ポリシーすべてに auth.uid() 直接比較の旧パターンが
--   残存していることが判明。
--
--   ow_conversation_participants.user_id は migration 061 で FK 先が
--   auth.users → ow_users に変更されたため、auth.uid()(Auth UUID)との
--   直接比較は常に不一致となり、B 画面でメッセージが 0 件、
--   C 機能でメッセージ送信が RLS 違反となる。
--
--   Step 2-2 の発見 λ(ow_conversations)および migration 064/066 と
--   完全に同一のパターン。
--
-- 修正方針:
--   ow_users 経由のサブクエリに統一(migration 066 と同じパターン):
--   `user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())`
--
-- 修正範囲(意図的に限定):
--   ✅ SELECT ポリシー(B 対話詳細画面の前提)
--   ✅ INSERT ポリシー(C メッセージ送信の前提)
--   ❌ UPDATE ポリシー(メッセージ編集機能実装時に対処予定)
--   ❌ ow_conversation_participants の UPDATE ポリシー(Step 4 で migration 069)
--   ❌ ow_conversation_participants の INSERT ポリシー(§4-8)
--   ❌ admin / company_admins 系ポリシー(別ロジック、変更なし)
--
-- =============================================================================
-- 関連する未対応事項:
--   - ow_conversation_messages の UPDATE ポリシー
--     auth.uid() 直接比較の旧パターン残存。
--     メッセージ編集機能実装時に migration として対処予定。
--
--   - ow_conversation_participants の UPDATE ポリシー
--     auth.uid() 直接比較の旧パターン残存。
--     Step 4 で D 既読処理(last_read_at 更新)実装時に migration 069 で対処予定。
--
--   - ow_conversation_participants の INSERT ポリシー(§4-8)
--     自己参照 + auth.uid() 直接比較の二重問題。
--     Phase ν-4 の B 画面 lazy 登録(企業担当者・メンター初回アクセス)実装時に対処予定。
--
-- スコープ規律: 本 migration は Step 3 の B + C 実装の前提条件である
-- SELECT + INSERT のみに絞る。学び 71/72 のスコープ規律遵守。
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. ow_conversation_messages SELECT ポリシー修正
-- 旧: ow_conversation_participants.user_id = auth.uid()
-- 新: ow_conversation_participants.user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
-- ============================================================
DROP POLICY IF EXISTS "ow_conversation_messages_select" ON ow_conversation_messages;

CREATE POLICY "ow_conversation_messages_select"
ON ow_conversation_messages
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants
    WHERE ow_conversation_participants.conversation_id = ow_conversation_messages.conversation_id
      AND ow_conversation_participants.user_id IN (
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
-- 2. ow_conversation_messages INSERT ポリシー修正
-- 旧: ow_conversation_participants.user_id = auth.uid()
-- 新: ow_conversation_participants.user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
-- ============================================================
DROP POLICY IF EXISTS "ow_conversation_messages_insert" ON ow_conversation_messages;

CREATE POLICY "ow_conversation_messages_insert"
ON ow_conversation_messages
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ow_conversation_participants
    WHERE ow_conversation_participants.id = ow_conversation_messages.sender_participant_id
      AND ow_conversation_participants.user_id IN (
        SELECT id FROM ow_users WHERE auth_id = auth.uid()
      )
      AND ow_conversation_participants.conversation_id = ow_conversation_messages.conversation_id
      AND ow_conversation_participants.left_at IS NULL
  )
);

-- ============================================================
-- 学び 75: schema_migrations への記録
-- ============================================================
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('068', 'fix_ow_conversation_messages_rls', NULL)
ON CONFLICT (version) DO NOTHING;

COMMIT;
