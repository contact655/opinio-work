-- フィード整合性チェッククエリ
-- 「フィードに出ていないコンテンツ」を検出する
-- Supabase SQL Editor で手動実行

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. フィードに出ていない公開求人
-- ─────────────────────────────────────────────────────────────────────────────
SELECT j.id, j.title, co.name AS company, j.status, j.published_at
FROM ow_jobs j
JOIN ow_companies co ON co.id = j.company_id
LEFT JOIN ow_posts p ON p.ref_job_id = j.id AND p.post_type = 'job_posted'
WHERE j.status IN ('published', 'active')
  AND p.id IS NULL
ORDER BY j.published_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. フィードに出ていない公開企業
-- ─────────────────────────────────────────────────────────────────────────────
SELECT c.id, c.name, c.brand_name, c.published_at
FROM ow_companies c
LEFT JOIN ow_posts p ON p.ref_company_id = c.id AND p.post_type = 'company_joined'
WHERE c.is_published = TRUE
  AND p.id IS NULL
ORDER BY c.published_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. フィードに出ていない公開記事
-- ─────────────────────────────────────────────────────────────────────────────
SELECT a.id, a.title, a.slug, a.published_at
FROM ow_articles a
LEFT JOIN ow_posts p ON p.ref_article_id = a.id AND p.post_type = 'article_published'
WHERE a.is_published = TRUE
  AND p.id IS NULL
ORDER BY a.published_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. 投稿タイプ別件数（全体確認）
-- ─────────────────────────────────────────────────────────────────────────────
SELECT post_type, COUNT(*) FROM ow_posts GROUP BY post_type ORDER BY post_type;
