-- Migration 123: ジャンル再設計 — 特徴タブ / 業種タブ
-- 2026-05-27

-- ── 1. 新ジャンル追加 ────────────────────────────────────────────────

-- 特徴タブ
INSERT INTO ow_genres (id, name, slug, description, display_order) VALUES
  (gen_random_uuid(), 'スタートアップ', 'startup',        'シード〜シリーズCのスタートアップ',    2),
  (gen_random_uuid(), '上場企業',       'public-company', '東証・NYSE上場企業',                   4)
ON CONFLICT (slug) DO NOTHING;

-- 業種タブ（将来用・現在0件）
INSERT INTO ow_genres (id, name, slug, description, display_order) VALUES
  (gen_random_uuid(), 'HealthTech',  'healthtech',      '医療・ヘルスケアテック',               215),
  (gen_random_uuid(), 'MarTech',     'martech',         'マーケティング・広告テック',           216),
  (gen_random_uuid(), 'PropTech',    'proptech',        '不動産・建設テック',                   217),
  (gen_random_uuid(), 'LegalTech',   'legaltech',       '法務・コンプライアンステック',         218),
  (gen_random_uuid(), 'データ分析',  'data-analytics',  'データ分析・BI・アナリティクス',       219),
  (gen_random_uuid(), 'EC・流通',    'ec-distribution', 'EC・物流・流通プラットフォーム',       220),
  (gen_random_uuid(), '業務DX',      'business-dx',     '業務効率化・デジタル変革',             221)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. 特徴タブ: スタートアップ (phase シリーズA/B/C) ────────────────
INSERT INTO ow_company_genres (company_id, genre_id)
SELECT c.id, g.id
FROM ow_companies c
CROSS JOIN ow_genres g
WHERE g.slug = 'startup'
  AND c.phase IN ('シリーズA', 'シリーズB', 'シリーズC')
  AND c.is_published = true
ON CONFLICT DO NOTHING;

-- ── 3. 特徴タブ: 上場企業 (phase 上場) ──────────────────────────────
INSERT INTO ow_company_genres (company_id, genre_id)
SELECT c.id, g.id
FROM ow_companies c
CROSS JOIN ow_genres g
WHERE g.slug = 'public-company'
  AND c.phase = '上場'
  AND c.is_published = true
ON CONFLICT DO NOTHING;
