-- Migration 234: /feed 遡及生成（企業・求人・記事）
--
-- 前提: Migration 233 が適用済みであること
--       システムユーザー UUID: 00000000-0000-0000-0000-000000000001
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ドライラン（実行前にこれを流して件数を確認してください）
-- ─────────────────────────────────────────────────────────────────────────────
--
--   -- 企業（company_joined）
--   SELECT COUNT(*) AS companies_to_insert
--   FROM ow_companies
--   WHERE is_published = TRUE;
--   -- 期待値: 80件
--
--   -- 求人（job_posted）
--   SELECT COUNT(*) AS jobs_to_insert
--   FROM ow_jobs
--   WHERE status IN ('published', 'active');
--   -- 期待値: 74件
--
--   -- 記事（article_published）
--   SELECT COUNT(*) AS articles_to_insert
--   FROM ow_articles
--   WHERE is_published = TRUE;
--   -- 期待値: 16件
--
--   -- 合計
--   SELECT
--     (SELECT COUNT(*) FROM ow_companies WHERE is_published = TRUE) AS companies,
--     (SELECT COUNT(*) FROM ow_jobs WHERE status IN ('published', 'active')) AS jobs,
--     (SELECT COUNT(*) FROM ow_articles WHERE is_published = TRUE) AS articles,
--     (SELECT COUNT(*) FROM ow_companies WHERE is_published = TRUE)
--     + (SELECT COUNT(*) FROM ow_jobs WHERE status IN ('published', 'active'))
--     + (SELECT COUNT(*) FROM ow_articles WHERE is_published = TRUE) AS total;
--   -- 期待値: 170件
--
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  system_user_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. 企業 → company_joined
--    content: 「{企業名}がOPINIOに掲載されました。」
--    created_at: ow_companies.created_at（元データの日時を使用）
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ow_posts (
  user_id,
  content,
  post_type,
  ref_company_id,
  created_at,
  updated_at
)
SELECT
  system_user_id,
  COALESCE(brand_name, name) || 'がOPINIOに掲載されました。'
    || CASE WHEN tagline IS NOT NULL AND tagline != '' THEN ' ' || tagline ELSE '' END,
  'company_joined',
  id,
  created_at,
  created_at
FROM ow_companies
WHERE is_published = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. 求人 → job_posted
--    content: 「{企業名}が「{職種}」の募集を開始しました。」
--    created_at: ow_jobs.published_at（なければ created_at）
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ow_posts (
  user_id,
  content,
  post_type,
  ref_job_id,
  ref_company_id,
  created_at,
  updated_at
)
SELECT
  system_user_id,
  COALESCE(co.brand_name, co.name) || 'が「' || j.title || '」の募集を開始しました。',
  'job_posted',
  j.id,
  j.company_id,
  COALESCE(j.published_at, j.created_at),
  COALESCE(j.published_at, j.created_at)
FROM ow_jobs j
JOIN ow_companies co ON co.id = j.company_id
WHERE j.status IN ('published', 'active');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 記事 → article_published
--    content: 「【取材記事】{タイトル}」
--    created_at: ow_articles.published_at（なければ created_at）
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ow_posts (
  user_id,
  content,
  post_type,
  ref_article_id,
  created_at,
  updated_at
)
SELECT
  system_user_id,
  '【取材記事】' || title,
  'article_published',
  id,
  COALESCE(published_at, created_at),
  COALESCE(published_at, created_at)
FROM ow_articles
WHERE is_published = TRUE;

END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 実行後確認クエリ:
--
--   SELECT post_type, COUNT(*) FROM ow_posts GROUP BY post_type ORDER BY post_type;
--   -- 期待値:
--   --   article_published | 16
--   --   company_joined    | 80
--   --   job_posted        | 74
--   --   user_post         |  2
--   --   （合計 172件）
--
--   -- 時系列が分散しているか確認
--   SELECT post_type, MIN(created_at), MAX(created_at)
--   FROM ow_posts
--   WHERE post_type != 'user_post'
--   GROUP BY post_type;
--
--   -- フィードの先頭20件（最新順）
--   SELECT post_type, content, created_at
--   FROM ow_posts
--   ORDER BY created_at DESC
--   LIMIT 20;
-- ─────────────────────────────────────────────────────────────────────────────
