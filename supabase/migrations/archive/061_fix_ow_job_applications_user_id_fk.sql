-- =============================================================================
-- Migration 061: ow_job_applications.user_id を ow_users 参照に修正
-- =============================================================================
-- 背景:
--   ow_job_applications.user_id だけが auth.users を参照していた(他 3
--   テーブル: ow_casual_meetings / ow_mentor_reservations / ow_bookmarks
--   は ow_users を参照)。本 migration で参照先を統一する。
--
-- 学び 73 関連:
--   引き継ぎ書 v12 では「ON DELETE SET NULL」と記載されていたが、
--   実態は pg_constraint 経由で確認済。
--
-- 学び 74 関連:
--   information_schema.referential_constraints は
--   supabase_read_only_user から不可視のため、pg_constraint で確認。
--
-- 学び 75(本 migration で発見):
--   schema_migrations テーブルは public スキーマに存在しない。
--   正しくは supabase_migrations.schema_migrations。
--   カラムは (version text, name text, statements text[]) — executed_at はない。
--   既存の 052〜060 は手動 INSERT 時に statements=NULL で記録されている。
--   本 migration もこのパターンに揃え、空配列ではなく NULL を採用。
--   supabase CLI による自動適用時のみ statements に実際の SQL が
--   配列で格納される(051 のパターン)。
--
-- 設計判断:
--   - ON DELETE: RESTRICT(安全側、退会時にデータが消えない)
--   - NOT NULL: ゲスト応募を許容しない
--   - 既存データ 0 件のため変換不要
--   - 他 3 テーブルは Phase η 前に「退会ポリシー」議論で一括見直し
--
-- 事前確認済み制約名:
--   ow_job_applications_user_id_fkey
--   (FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL)
--
-- 影響範囲:
--   - DB: ow_job_applications.user_id の FK 先と NOT NULL
--   - API: src/app/api/applications/route.ts に resolveOwUserId() 追加が必要
-- =============================================================================

BEGIN;

-- 1. 既存 FK 制約を DROP
ALTER TABLE ow_job_applications
  DROP CONSTRAINT IF EXISTS ow_job_applications_user_id_fkey;

-- 2. user_id を NOT NULL に
ALTER TABLE ow_job_applications
  ALTER COLUMN user_id SET NOT NULL;

-- 3. 新 FK 制約を ADD(ow_users 参照、RESTRICT)
ALTER TABLE ow_job_applications
  ADD CONSTRAINT ow_job_applications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES ow_users(id) ON DELETE RESTRICT;

-- 4. supabase_migrations.schema_migrations に記録
--    (public.schema_migrations は存在しない、学び 75)
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '061',
  'fix_ow_job_applications_user_id_fk',
  NULL
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
