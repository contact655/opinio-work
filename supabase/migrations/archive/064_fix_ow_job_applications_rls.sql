-- =============================================================================
-- Migration 064: ow_job_applications RLS ポリシー修正
-- =============================================================================
-- 背景:
--   Step 0-1 の migration 061 で ow_job_applications.user_id の FK 先を
--   auth.users から ow_users に変更したが、RLS ポリシーは旧仕様
--   (auth.uid() = user_id 直接比較)のまま残存していた。
--
--   結果として「全ての応募 INSERT が RLS で拒否される」「自分の応募一覧も
--   見られない」という致命バグが発生。Step 1-5 動作確認(シナリオ 1)で発覚。
--
-- 修正方針:
--   ow_casual_meetings と同じパターン
--   (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())) に統一。
--
--   company_admins_* ポリシーは ow_users 経由で書かれており影響なし、修正不要。
--
-- 影響範囲:
--   ow_job_applications のみ(他テーブルは Step 0-1 で FK 変更していないため
--   現状のポリシーで正しく動作)。
-- =============================================================================

BEGIN;

-- ============================================================
-- INSERT ポリシーの修正
-- 旧: WITH CHECK ((auth.uid() = user_id) OR (user_id IS NULL))
-- 新: WITH CHECK (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()))
-- ============================================================
DROP POLICY IF EXISTS "users can insert own applications" ON ow_job_applications;

CREATE POLICY "users can insert own applications"
ON ow_job_applications
FOR INSERT
TO public
WITH CHECK (
  user_id IN (
    SELECT id FROM ow_users WHERE auth_id = auth.uid()
  )
);

-- ============================================================
-- SELECT ポリシーの修正
-- 旧: USING (auth.uid() = user_id)
-- 新: USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()))
-- ============================================================
DROP POLICY IF EXISTS "users can read own applications" ON ow_job_applications;

CREATE POLICY "users can read own applications"
ON ow_job_applications
FOR SELECT
TO public
USING (
  user_id IN (
    SELECT id FROM ow_users WHERE auth_id = auth.uid()
  )
);

-- ============================================================
-- 学び 75: schema_migrations への記録
-- ============================================================
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('064', 'fix_ow_job_applications_rls', NULL)
ON CONFLICT (version) DO NOTHING;

COMMIT;
