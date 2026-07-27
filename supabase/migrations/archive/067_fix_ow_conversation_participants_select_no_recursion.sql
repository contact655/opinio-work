-- =============================================================================
-- Migration 067: ow_conversation_participants SELECT RLS 自己参照解消
-- =============================================================================
-- 背景:
--   migration 066 で適用した ow_conversation_participants_select ポリシーが
--   ow_conversation_participants 自身を参照する自己参照構造になっており、
--   クライアントが ow_conversations を SELECT すると
--   "infinite recursion detected in policy for relation ow_conversation_participants"
--   (PostgreSQL 42P17) が発生する。
--
--   発覚: Phase ν-3 Step 2-3 — /mypage/conversations ページの動作確認時。
--
-- 原因:
--   USING 句内で "SELECT 1 FROM ow_conversation_participants self" と
--   同テーブルを直接参照しているため、PostgreSQL がポリシー評価を
--   無限に繰り返す。
--
-- 修正方針:
--   自己参照なし版に書き換える。
--   「自分の user_id を持つ行のみ見える」シンプルな条件で十分。
--   ow_conversations 側の SELECT ポリシーが「participants に自分が含まれる対話」
--   を判定するため、participants 側は自分の行を返せれば OK。
--
-- 修正範囲(意図的に限定):
--   ✅ ow_conversation_participants の SELECT ポリシー（自己参照解消）
--   ❌ INSERT ポリシー（§4-8、Step 3 で対処）
--   ❌ UPDATE ポリシー（Step 3 で対処）
--   ❌ ow_conversations 側は変更なし
--
-- =============================================================================
-- 関連する未対応事項(Step 3 で対処予定):
--   - ow_conversation_participants の INSERT ポリシー(§4-8)
--     自己参照 + auth.uid() 直接比較の二重問題。
--     現状 create_conversation RPC が SECURITY DEFINER でバイパス、顕在化なし。
--     Step 3 で B 画面 lazy 登録実装時に対処予定。
--
--   - ow_conversation_participants の UPDATE ポリシー
--     auth.uid() 直接比較の旧パターン。
--     Step 3 で D 既読処理(last_read_at 更新)実装時に migration 068 で対処。
--
--   - ow_conversations の UPDATE ポリシー
--     ow_conversation_participants 参照 + auth.uid() 直接比較。
--     Step 3 で対話の stage 変更等を実装時に対処予定。
--
-- スコープ規律: 本 migration は Step 2-3 の発見 ν(無限再帰エラー)解消のみ。
-- 学び 71/72 のスコープ規律遵守。
-- =============================================================================

BEGIN;

-- ============================================================
-- ow_conversation_participants SELECT ポリシー 自己参照なし版に置き換え
-- 旧: SELECT 1 FROM ow_conversation_participants self WHERE self.conversation_id = ...
-- 新: user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
-- ============================================================
DROP POLICY IF EXISTS "ow_conversation_participants_select" ON ow_conversation_participants;

CREATE POLICY "ow_conversation_participants_select"
ON ow_conversation_participants
FOR SELECT
TO public
USING (
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
VALUES ('067', 'fix_ow_conversation_participants_select_no_recursion', NULL)
ON CONFLICT (version) DO NOTHING;

COMMIT;
