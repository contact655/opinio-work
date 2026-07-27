-- Migration 233: ow_posts スキーマ拡張 + OPINIOシステムユーザー作成
--
-- 実行前確認クエリ:
--   SELECT COUNT(*) FROM ow_posts;                    -- 現在の投稿数（2件を想定）
--   SELECT COUNT(*) FROM ow_users WHERE name = 'OPINIO';  -- 0件を確認
--   \d ow_posts                                        -- 現在のカラム一覧

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ow_users に is_system フラグを追加
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ow_users
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. OPINIOシステムユーザーを作成
--    固定UUID: 00000000-0000-0000-0000-000000000001
--    Migration 234（遡及生成）でこの UUID を参照する
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ow_users (
  id,
  auth_id,
  email,
  name,
  visibility,
  is_system,
  avatar_color,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'system@opinio.co.jp',
  'OPINIO',
  'private',
  TRUE,
  'linear-gradient(135deg, #002366, #3B5FD9)',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ow_posts にカラム追加
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ow_posts
  ADD COLUMN IF NOT EXISTS post_type       TEXT NOT NULL DEFAULT 'user_post',
  ADD COLUMN IF NOT EXISTS ref_company_id  UUID REFERENCES ow_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ref_job_id      UUID REFERENCES ow_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ref_article_id  UUID REFERENCES ow_articles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ref_user_id     UUID REFERENCES ow_users(id) ON DELETE SET NULL;

-- 既存2件は user_post のまま（DEFAULT 値で自動設定済み）

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. INDEX
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ow_posts_post_type    ON ow_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_ow_posts_created_at   ON ow_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ow_posts_ref_company  ON ow_posts(ref_company_id) WHERE ref_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ow_posts_ref_job      ON ow_posts(ref_job_id) WHERE ref_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ow_posts_ref_article  ON ow_posts(ref_article_id) WHERE ref_article_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 実行後確認クエリ:
--   SELECT id, name, is_system, visibility FROM ow_users WHERE is_system = TRUE;
--   -- → 1件: 00000000-0000-0000-0000-000000000001 / OPINIO / true / private
--
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'ow_posts'
--   ORDER BY ordinal_position;
--   -- → post_type, ref_company_id, ref_job_id, ref_article_id, ref_user_id が追加されている
-- ─────────────────────────────────────────────────────────────────────────────
