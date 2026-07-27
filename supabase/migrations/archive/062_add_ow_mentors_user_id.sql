-- =============================================================================
-- Migration 062: ow_mentors に user_id カラムを追加
-- =============================================================================
-- 背景:
--   Phase ν-3（求職者対話 UI）で「自分がメンターである」ことを
--   ow_mentors レコードと紐づける必要がある。現状 ow_mentors には
--   ow_users への参照がなく、auth.users.id とメンターレコードを
--   結びつける手段がない。
--
-- 学び 73 関連:
--   CLAUDE.md には「mentors テーブル（10件）」と記載されていたが、
--   実態は ow_mentors（30件）であった。ドキュメントより DB 実態を
--   MCP で直接確認することが正確な情報源。
--
-- 学び 74 関連:
--   FK 制約の確認は information_schema.referential_constraints では
--   なく pg_constraint を使う（supabase_read_only_user から不可視）。
--
-- 学び 75 関連:
--   schema_migrations は supabase_migrations スキーマ内に存在。
--   カラムは (version, name, statements)。手動 INSERT 時は
--   statements=NULL（051 以外は全件 NULL）。
--
-- 設計判断:
--   - 判断 1: テストデータ全件 DELETE（30件、name=メンター_NNN パターン）
--     バックアップ: docs/backups/ow_mentors_backup_2026-05-05.txt
--   - 判断 2: user_id は NULL 許容（Phase ν-5 までは実際のメンターが
--     未登録のため、既存 API を壊さないよう NULL を許容する）
--   - 判断 3: ON DELETE RESTRICT（安全側、ow_users 削除時にメンター
--     レコードを誤って巻き込まない）
--   - 判断 4: UNIQUE(user_id) あり（1 ユーザー = 1 メンターレコード）
--     NULLS DISTINCT（デフォルト、NULL 同士は重複扱いしない）
--
-- 影響範囲:
--   - DB: ow_mentors に user_id UUID 列 + FK + UNIQUE 制約
--   - API: /api/mentor-reservations — Phase ν-5 で mentor_user_id 解決ロジック追加予定
--   - 既存の SELECT クエリには影響なし（新カラムは NULL 許容）
--
-- 制約名:
--   ow_mentors_user_id_fkey   — FK → ow_users(id) ON DELETE RESTRICT
--   ow_mentors_user_id_unique — UNIQUE(user_id) NULLS DISTINCT
-- =============================================================================

BEGIN;

-- 1. テストデータ全件削除
--    （バックアップ済: docs/backups/ow_mentors_backup_2026-05-05.txt）
DELETE FROM ow_mentors;

-- 2. user_id カラムを追加（NULL 許容、既存行がないので DEFAULT 不要）
ALTER TABLE ow_mentors
  ADD COLUMN user_id UUID NULL;

-- 3. FK 制約を追加（ow_users 参照、ON DELETE RESTRICT）
ALTER TABLE ow_mentors
  ADD CONSTRAINT ow_mentors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES ow_users(id) ON DELETE RESTRICT;

-- 4. UNIQUE 制約を追加（NULLS DISTINCT はデフォルト、明示不要だが意図を示す）
ALTER TABLE ow_mentors
  ADD CONSTRAINT ow_mentors_user_id_unique
  UNIQUE (user_id);

-- 5. supabase_migrations.schema_migrations に記録
--    （学び 75: public.schema_migrations は存在しない）
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '062',
  'add_ow_mentors_user_id',
  NULL
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
