-- Migration 142: Add major SaaS companies for article linking

INSERT INTO ow_companies (
  id,
  name,
  tagline,
  industry,
  phase,
  employee_count,
  location,
  remote_work_status,
  logo_gradient,
  logo_letter,
  founded_year,
  is_published,
  accepting_casual_meetings,
  status
) VALUES
(
  'aaaaaaaa-0001-0001-0001-000000000001',
  '株式会社SmartHR',
  '人事労務の煩雑な業務をシステム化し、もっと本質的な仕事へ',
  'HR Tech',
  'unicorn',
  '約1500名',
  '東京都',
  'hybrid',
  'linear-gradient(135deg, #EF4444, #F97316)',
  'S',
  2013,
  true,
  false,
  'active'
),
(
  'aaaaaaaa-0001-0001-0001-000000000002',
  '株式会社LayerX',
  'すべての経済活動をデジタル化する、FinTech×Enterprise SaaS',
  'FinTech/SaaS',
  'series_c',
  '約400名',
  '東京都',
  'hybrid',
  'linear-gradient(135deg, #1E1E2E, #374151)',
  'L',
  2018,
  true,
  false,
  'active'
),
(
  'aaaaaaaa-0001-0001-0001-000000000003',
  'freee株式会社',
  'スモールビジネスのバックオフィスから、統合型経営プラットフォームへ',
  'FinTech/SaaS',
  'listed',
  '約1600名',
  '東京都',
  'hybrid',
  'linear-gradient(135deg, #7C3AED, #A78BFA)',
  'f',
  2012,
  true,
  false,
  'active'
),
(
  'aaaaaaaa-0001-0001-0001-000000000004',
  'Sansan株式会社',
  '名刺から始まり、営業DXの経営インフラへ',
  'Sales Tech',
  'listed',
  '約1300名',
  '東京都',
  'hybrid',
  'linear-gradient(135deg, #0EA5E9, #38BDF8)',
  'S',
  2007,
  true,
  false,
  'active'
),
(
  'aaaaaaaa-0001-0001-0001-000000000005',
  '株式会社PKSHA Technology',
  'アルゴリズムと人間知性の融合で、未来の共創を拓く',
  'AI Tech',
  'listed',
  '約500名',
  '東京都',
  'hybrid',
  'linear-gradient(135deg, #1D4ED8, #3B82F6)',
  'P',
  2012,
  true,
  false,
  'active'
),
(
  'aaaaaaaa-0001-0001-0001-000000000006',
  'ユビー株式会社',
  '医療とテクノロジーで、病気で悩む時間を世界からなくす',
  'Med Tech',
  'unicorn',
  '約400名',
  '東京都',
  'hybrid',
  'linear-gradient(135deg, #0D9488, #14B8A6)',
  'U',
  2017,
  true,
  false,
  'active'
),
(
  'aaaaaaaa-0001-0001-0001-000000000007',
  'HubSpot Japan株式会社',
  '顧客を中心に据えたCRM・マーケティングプラットフォームで成長を加速',
  'CRM/SaaS',
  'listed',
  '約300名（日本）',
  '東京都',
  'hybrid',
  'linear-gradient(135deg, #EA580C, #FB923C)',
  'H',
  2013,
  true,
  false,
  'active'
);

-- Link articles to newly inserted companies

UPDATE ow_articles
SET company_id = 'aaaaaaaa-0001-0001-0001-000000000004'
WHERE slug = 'sansan-kato-pdm-career';

UPDATE ow_articles
SET company_id = 'aaaaaaaa-0001-0001-0001-000000000005'
WHERE slug = 'pksha-ml-culture-ceo';

UPDATE ow_articles
SET company_id = 'aaaaaaaa-0001-0001-0001-000000000006'
WHERE slug = 'ubie-taniguchi-cto-journey';

UPDATE ow_articles
SET company_id = 'aaaaaaaa-0001-0001-0001-000000000001'
WHERE slug = 'smarthr-ceo-hr-tech-future';

UPDATE ow_articles
SET company_id = 'aaaaaaaa-0001-0001-0001-000000000001'
WHERE slug = 'smarthr-hayashi-csm-career';

UPDATE ow_articles
SET company_id = 'aaaaaaaa-0001-0001-0001-000000000003'
WHERE slug = 'freee-platform-infra-report';

UPDATE ow_articles
SET company_id = 'aaaaaaaa-0001-0001-0001-000000000002'
WHERE slug = 'layerx-suzuki-backend-career';

UPDATE ow_articles
SET company_id = 'aaaaaaaa-0001-0001-0001-000000000007'
WHERE slug = 'hubspot-product-org-report';

UPDATE ow_articles
SET company_id = 'aaaaaaaa-0001-0001-0001-000000000002'
WHERE slug = 'layerx-nakamura-why-mentor';

-- Fix article title: remove mentor reference from layerx-nakamura-why-mentor

UPDATE ow_articles
SET title = '「ITキャリアで大切にしてきたこと」LayerXエンジニアが振り返る、転職3回の軌跡'
WHERE slug = 'layerx-nakamura-why-mentor';
