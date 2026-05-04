-- ============================================================
-- Phase ζ-2.5.7: ow_company_photos テーブルの DROP
-- ============================================================
-- 背景:
--   - migration 031 (Phase 1 core schema) で ow_company_office_photos が
--     新設され、写真機能がそちらに統一された
--   - mypage/applications (SSS, c124b60) と queries.ts (PPP, 8c3eefe) で
--     ow_company_photos への現役参照が全て除去済み
--   - business/company.ts の TODO も解消済み (本 migration と同コミット)
--   - 本番データは 0 件、FK 依存もなし、安全に DROP 可能
-- ============================================================
-- RLS ポリシー一覧 (pg_policy で確認済み 2026-05-05):
--   ow_company_photos_public_read (SELECT)
--   ow_company_photos_own_select  (SELECT)
--   ow_company_photos_own_insert  (INSERT)
--   ow_company_photos_own_update  (UPDATE)
--   ow_company_photos_own_delete  (DELETE)
-- ============================================================

-- RLS ポリシー DROP
DROP POLICY IF EXISTS "ow_company_photos_public_read" ON ow_company_photos;
DROP POLICY IF EXISTS "ow_company_photos_own_select"  ON ow_company_photos;
DROP POLICY IF EXISTS "ow_company_photos_own_insert"  ON ow_company_photos;
DROP POLICY IF EXISTS "ow_company_photos_own_update"  ON ow_company_photos;
DROP POLICY IF EXISTS "ow_company_photos_own_delete"  ON ow_company_photos;

-- テーブル DROP (CASCADE で FK 等の残存依存も解消)
DROP TABLE IF EXISTS ow_company_photos CASCADE;
