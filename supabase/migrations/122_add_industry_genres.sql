-- Migration 122: 業種別ジャンルを追加 + company.industry で自動紐づけ
-- 2026-05-27

-- ── 1. 新ジャンルを追加 ───────────────────────────────────────────────
INSERT INTO ow_genres (id, name, slug, description, display_order) VALUES
  (gen_random_uuid(), 'HRTech・採用',  'hrtech',        '採用・人事・労務のプロダクト',      9),
  (gen_random_uuid(), 'FinTech・金融', 'fintech',       '金融・決済・会計・保険',           10),
  (gen_random_uuid(), 'EdTech・学習',  'edtech',        '教育・学習・スキルアップ',          11),
  (gen_random_uuid(), 'M&A・投資',     'ma-investment', 'M&A・事業承継・投資管理プラットフォーム', 12)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. industry 列を元に自動紐づけ ──────────────────────────────────────

-- HRTech
INSERT INTO ow_company_genres (company_id, genre_id)
SELECT c.id, g.id
FROM ow_companies c
CROSS JOIN ow_genres g
WHERE g.slug = 'hrtech'
  AND c.industry ILIKE 'HRTech%'
  AND c.is_published = true
ON CONFLICT DO NOTHING;

-- FinTech
INSERT INTO ow_company_genres (company_id, genre_id)
SELECT c.id, g.id
FROM ow_companies c
CROSS JOIN ow_genres g
WHERE g.slug = 'fintech'
  AND c.industry ILIKE 'FinTech%'
  AND c.is_published = true
ON CONFLICT DO NOTHING;

-- EdTech
INSERT INTO ow_company_genres (company_id, genre_id)
SELECT c.id, g.id
FROM ow_companies c
CROSS JOIN ow_genres g
WHERE g.slug = 'edtech'
  AND c.industry ILIKE 'EdTech%'
  AND c.is_published = true
ON CONFLICT DO NOTHING;

-- M&A (MA)
INSERT INTO ow_company_genres (company_id, genre_id)
SELECT c.id, g.id
FROM ow_companies c
CROSS JOIN ow_genres g
WHERE g.slug = 'ma-investment'
  AND c.industry IN ('MA', 'M&A')
  AND c.is_published = true
ON CONFLICT DO NOTHING;

-- ── 3. 結果確認クエリ（参考） ──────────────────────────────────────────
-- SELECT g.name, COUNT(cg.company_id) as cnt
-- FROM ow_genres g
-- LEFT JOIN ow_company_genres cg ON cg.genre_id = g.id
-- GROUP BY g.name, g.display_order
-- ORDER BY g.display_order;
