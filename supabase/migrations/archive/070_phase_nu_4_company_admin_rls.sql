-- =============================================================================
-- Migration 070: Phase ν-4 企業側 HR の対話参加・閲覧 RLS
-- =============================================================================
-- Phase ν-4 Sub-step 4A-4
-- 目的:
--   1. ow_conversation_participants INSERT ポリシーの修正
--      (§4-8: auth.uid() 直接比較 → ow_users 経由の正しいパターン + company_admin 参加条件)
--   2. ow_conversations SELECT ポリシーの緩和
--      (同社 ow_company_admins 登録済み HR が自社対話を閲覧可能に)
--   3. ow_conversation_participants SELECT ポリシーの緩和
--      (同社 HR が対話参加者一覧を閲覧可能に)
--
-- 背景:
--   - ow_conversation_participants INSERT: migration 060 からの旧パターン残存
--     `existing.user_id = auth.uid()` は ow_users.id (ow UUID) vs auth.uid() (auth UUID)
--     の UUID 空間不一致により常に false → admin のみ INSERT 可という状態だった
--     (migration 068 が ow_conversation_messages の同問題を修正済み、participants は未対応)
--
--   - ow_conversations SELECT: 現状は participant 登録済みのみ閲覧可能
--     企業側 HR が /biz/conversations 一覧を開くためには company_admin 条件が必要
--
--   - ow_conversation_participants SELECT: 現状は自分のレコードのみ参照可能
--     /biz/conversations/[id] 詳細で HR が参加者一覧(候補者名等)を見るために緩和が必要
--
-- 注意事項:
--   - ow_conversation_messages の INSERT/SELECT は migration 068 で修正済み → 本 migration では変更しない
--   - create_conversation RPC は prosecdef=true (SECURITY DEFINER) → RLS バイパス → 本修正の影響なし
--   - ow_conversations INSERT / ow_conversation_participants UPDATE は変更しない
--
-- ロールバック: supabase/rollbacks/070_rollback.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- Section 1: ow_conversation_participants INSERT ポリシー修正
-- =============================================================================
-- 旧: existing.user_id = auth.uid()  ← 常に false (UUID 空間不一致)
-- 新:
--   条件 A: 同じ対話の既存 participant (ow_users.id 経由で正確に比較)
--   条件 B: 同社 ow_company_admins に登録された HR が自社対話に参加
--   条件 C: admin (運営)
-- =============================================================================
DROP POLICY IF EXISTS "ow_conversation_participants_insert" ON ow_conversation_participants;

CREATE POLICY "ow_conversation_participants_insert"
ON ow_conversation_participants
FOR INSERT
WITH CHECK (
  -- 条件 A: 同じ対話の既存 participant として正しく比較
  EXISTS (
    SELECT 1 FROM ow_conversation_participants existing
    JOIN ow_users u ON u.id = existing.user_id
    WHERE existing.conversation_id = ow_conversation_participants.conversation_id
      AND u.auth_id = auth.uid()
      AND existing.left_at IS NULL
  )
  -- 条件 B: 同社の ow_company_admins に登録された HR 担当者が自社対話に参加
  OR EXISTS (
    SELECT 1 FROM ow_company_admins ca
    JOIN ow_users u ON u.id = ca.user_id
    JOIN ow_conversations c ON c.company_id = ca.company_id
    WHERE c.id = ow_conversation_participants.conversation_id
      AND u.auth_id = auth.uid()
      AND ca.is_active = true
  )
  -- 条件 C: admin (運営)
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- =============================================================================
-- Section 2: ow_conversations SELECT ポリシー緩和
-- =============================================================================
-- 旧: participant 登録済み OR admin のみ閲覧可
-- 新: participant 登録済み OR 同社 company_admin OR admin
-- =============================================================================
DROP POLICY IF EXISTS "ow_conversations_select" ON ow_conversations;

CREATE POLICY "ow_conversations_select"
ON ow_conversations
FOR SELECT
USING (
  -- 条件 A: 参加者として登録済み (従来通り)
  EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = ow_conversations.id
      AND p.user_id IN (
        SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
      )
  )
  -- 条件 B: 同社の ow_company_admins 登録済み HR 担当者 (緩和)
  OR (
    ow_conversations.company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM ow_company_admins ca
      JOIN ow_users u ON u.id = ca.user_id
      WHERE ca.company_id = ow_conversations.company_id
        AND u.auth_id = auth.uid()
        AND ca.is_active = true
    )
  )
  -- 条件 C: admin (運営)
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- =============================================================================
-- Section 3: ow_conversation_participants SELECT ポリシー緩和
-- =============================================================================
-- 旧: 自分の participant レコードのみ閲覧可 OR admin
-- 新: 自分の participant レコード OR 同社 company_admin が同じ対話の参加者一覧を閲覧 OR admin
-- =============================================================================
DROP POLICY IF EXISTS "ow_conversation_participants_select" ON ow_conversation_participants;

CREATE POLICY "ow_conversation_participants_select"
ON ow_conversation_participants
FOR SELECT
USING (
  -- 条件 A: 自分のレコード (従来通り)
  user_id IN (
    SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
  )
  -- 条件 B: 同社 company_admin が同じ対話の参加者を閲覧 (緩和)
  OR EXISTS (
    SELECT 1 FROM ow_company_admins ca
    JOIN ow_users u ON u.id = ca.user_id
    JOIN ow_conversations c ON c.id = ow_conversation_participants.conversation_id
    WHERE c.company_id = ca.company_id
      AND u.auth_id = auth.uid()
      AND ca.is_active = true
  )
  -- 条件 C: admin (運営)
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- =============================================================================
-- schema_migrations への記録
-- =============================================================================
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('070', 'phase_nu_4_company_admin_rls', NULL)
ON CONFLICT (version) DO NOTHING;

COMMIT;
