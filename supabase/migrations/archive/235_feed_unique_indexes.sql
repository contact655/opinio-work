-- Migration 235: ow_posts フィード重複防止 UNIQUE インデックス
--
-- 前提: Migration 234 の遡及INSERT（172件）が重複なしであることを確認済み
--
-- ─────────────────────────────────────────────────────────────────────────────
-- DRY RUN（適用前に実行して 0 rows を確認してください）
-- ─────────────────────────────────────────────────────────────────────────────
--
-- SELECT ref_company_id, COUNT(*)
-- FROM ow_posts
-- WHERE post_type = 'company_joined' AND ref_company_id IS NOT NULL
-- GROUP BY ref_company_id HAVING COUNT(*) > 1;
-- -- 期待値: 0 rows
--
-- SELECT ref_job_id, COUNT(*)
-- FROM ow_posts
-- WHERE post_type = 'job_posted' AND ref_job_id IS NOT NULL
-- GROUP BY ref_job_id HAVING COUNT(*) > 1;
-- -- 期待値: 0 rows
--
-- SELECT ref_article_id, COUNT(*)
-- FROM ow_posts
-- WHERE post_type = 'article_published' AND ref_article_id IS NOT NULL
-- GROUP BY ref_article_id HAVING COUNT(*) > 1;
-- -- 期待値: 0 rows
--
-- ─────────────────────────────────────────────────────────────────────────────

-- 企業掲載: 同一企業の company_joined は1件まで
CREATE UNIQUE INDEX IF NOT EXISTS idx_ow_posts_unique_company
  ON ow_posts(ref_company_id)
  WHERE ref_company_id IS NOT NULL AND post_type = 'company_joined';

-- 求人掲載: 同一求人の job_posted は1件まで
CREATE UNIQUE INDEX IF NOT EXISTS idx_ow_posts_unique_job
  ON ow_posts(ref_job_id)
  WHERE ref_job_id IS NOT NULL AND post_type = 'job_posted';

-- 記事掲載: 同一記事の article_published は1件まで
CREATE UNIQUE INDEX IF NOT EXISTS idx_ow_posts_unique_article
  ON ow_posts(ref_article_id)
  WHERE ref_article_id IS NOT NULL AND post_type = 'article_published';

-- ─────────────────────────────────────────────────────────────────────────────
-- 適用後確認:
--   \d ow_posts  →  3つのインデックスが追加されていること
--   または:
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'ow_posts'
--   AND indexname LIKE 'idx_ow_posts_unique%';
-- ─────────────────────────────────────────────────────────────────────────────
