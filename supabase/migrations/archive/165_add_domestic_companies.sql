-- Migration 165: 国内主要IT企業を追加 + ow_articles.company_id を設定
-- 対象: LayerX, SmartHR, Sansan, PKSHA Technology, Ubie, freee
-- 手動適用: Supabase ダッシュボード → SQL Editor で実行

-- ──────────────────────────────────────────────────────────────────────────────
-- Step 1: 6社を ow_companies に INSERT
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO ow_companies (
  id, name, tagline, industry, phase, employee_count, founded_year,
  location, remote_work_status, flex_time, side_job_ok,
  accepting_casual_meetings, is_published,
  logo_letter, logo_gradient, company_features,
  fit_positives, why_join
) VALUES

-- LayerX
(
  gen_random_uuid(),
  '株式会社LayerX',
  '「すべての経済活動を、デジタル化する」',
  'FinTech/SaaS',
  'シリーズB',
  '100〜300名',
  2018,
  '東京都中央区',
  'full_remote',
  true,
  true,
  true,
  true,
  'L',
  'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
  to_jsonb(ARRAY['バクラク', 'FinTech最前線', 'リモートファースト', 'ミッションドリブン', '急成長']),
  to_jsonb(ARRAY['経費精算・請求書領域のトップランナー', 'フルリモート可でエンジニアに優しい環境', 'シリーズB以降も急成長継続中']),
  '「すべての経済活動をデジタル化する」という明確なミッションのもと、バクラク事業で急成長中。エンジニアが主役の文化で技術的なチャレンジが多い。'
),

-- SmartHR
(
  gen_random_uuid(),
  'SmartHR株式会社',
  '「労働にまつわる社会課題をなくしていく」',
  'HR Tech',
  'ユニコーン',
  '1000名以上',
  2013,
  '東京都港区',
  'full_remote',
  true,
  true,
  true,
  true,
  'S',
  'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
  to_jsonb(ARRAY['HR SaaSリーダー', 'ユニコーン企業', '社会課題解決', 'リモートワーク推進', '急成長']),
  to_jsonb(ARRAY['人事労務クラウドの国内シェアNo.1', '「はたらくすべての人を、自由に。」という強いミッション', '複数シリーズでの大型資金調達歴']),
  '労務手続きのDXを通じて社会課題を解決。HR Tech分野のユニコーン企業として、国内外の大手企業にも導入が進む。'
),

-- Sansan
(
  gen_random_uuid(),
  'Sansan株式会社',
  '「出会いからイノベーションを生み出す」',
  'Sales Tech',
  '上場',
  '1000名以上',
  2007,
  '東京都渋谷区',
  'hybrid',
  true,
  false,
  true,
  true,
  'S',
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  to_jsonb(ARRAY['名刺管理SaaS', '東証プライム上場', 'B2Bプラットフォーム', 'データ活用', '経営インフラ化']),
  to_jsonb(ARRAY['名刺管理から経営インフラへ進化するユニークな成長ストーリー', '東証プライム上場の安定基盤', 'Bill Oneなど新規事業への積極投資']),
  '名刺管理SaaSから出発し、営業・請求書・請求書処理など幅広い経営インフラを提供。上場後も新規事業に積極的。'
),

-- PKSHA Technology
(
  gen_random_uuid(),
  '株式会社PKSHA Technology',
  '「Advancing Humanity」',
  'AI Tech',
  '上場',
  '100〜300名',
  2012,
  '東京都文京区',
  'hybrid',
  true,
  false,
  true,
  true,
  'P',
  'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
  to_jsonb(ARRAY['AI研究×事業', '東証グロース上場', '研究開発力', 'アカデミア出身', '機械学習最前線']),
  to_jsonb(ARRAY['AIアルゴリズムの研究開発から事業化まで一貫して行うユニークな体制', '東京大学発のスピンオフで研究水準が高い', '金融・製造・小売など多様な業界への展開']),
  '深層学習・自然言語処理など先端AIの研究開発と事業化を両立。人間とAIの新しい協調モデルを目指す上場AI企業。'
),

-- Ubie
(
  gen_random_uuid(),
  'Ubie株式会社',
  '「テクノロジーで人々を適切な医療に案内する」',
  'AI Tech',
  'ユニコーン',
  '300〜500名',
  2017,
  '東京都中央区',
  'full_remote',
  true,
  true,
  true,
  true,
  'U',
  'linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)',
  to_jsonb(ARRAY['ヘルスケアAI', 'ユニコーン企業', '医療×テック', 'グローバル展開', 'ミッションドリブン']),
  to_jsonb(ARRAY['医師とエンジニアが共同創業した独自のDNA', '症状検索エンジンで数千万ユーザーに貢献', '米国・東南アジアへのグローバル展開中']),
  '医師とエンジニアが共同創業したヘルスケアAIスタートアップ。AIによる症状チェックで患者を適切な医療に案内するプラットフォームを展開中。'
),

-- freee
(
  gen_random_uuid(),
  'freee株式会社',
  '「スモールビジネスを、世界の主役に。」',
  'FinTech/SaaS',
  '上場',
  '1000名以上',
  2012,
  '東京都品川区',
  'hybrid',
  true,
  false,
  true,
  true,
  'F',
  'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
  to_jsonb(ARRAY['会計SaaS', '東証グロース上場', 'スモールビジネス支援', 'バックオフィスDX', 'オープンAPI']),
  to_jsonb(ARRAY['クラウド会計・人事労務の国内シェアトップクラス', 'スモールビジネスへの強い共感とミッション', '上場後も積極的なプロダクト投資']),
  '「スモールビジネスを世界の主役に」を掲げ、会計・給与・申告など経営バックオフィスをワンストップでクラウド化。東証グロース上場。'
)

ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────────
-- Step 2: ow_articles.company_id を設定
-- ──────────────────────────────────────────────────────────────────────────────

UPDATE ow_articles SET company_id = (SELECT id FROM ow_companies WHERE name = '株式会社LayerX' LIMIT 1)
WHERE slug IN ('layerx-nakamura-why-mentor', 'layerx-suzuki-backend-career');

UPDATE ow_articles SET company_id = (SELECT id FROM ow_companies WHERE name = 'SmartHR株式会社' LIMIT 1)
WHERE slug IN ('smarthr-ceo-hr-tech-future', 'smarthr-hayashi-csm-career');

UPDATE ow_articles SET company_id = (SELECT id FROM ow_companies WHERE name = 'Sansan株式会社' LIMIT 1)
WHERE slug = 'sansan-kato-pdm-career';

UPDATE ow_articles SET company_id = (SELECT id FROM ow_companies WHERE name = '株式会社PKSHA Technology' LIMIT 1)
WHERE slug = 'pksha-ml-culture-ceo';

UPDATE ow_articles SET company_id = (SELECT id FROM ow_companies WHERE name = 'Ubie株式会社' LIMIT 1)
WHERE slug = 'ubie-taniguchi-cto-journey';

UPDATE ow_articles SET company_id = (SELECT id FROM ow_companies WHERE name = 'freee株式会社' LIMIT 1)
WHERE slug = 'freee-platform-infra-report';

-- ──────────────────────────────────────────────────────────────────────────────
-- Step 3: 新規6社に company_features を設定（上書き確認）
-- ──────────────────────────────────────────────────────────────────────────────

-- 確認クエリ
SELECT name, phase, company_features FROM ow_companies
WHERE name IN ('株式会社LayerX','SmartHR株式会社','Sansan株式会社','株式会社PKSHA Technology','Ubie株式会社','freee株式会社')
ORDER BY name;

SELECT a.title, a.slug, c.name AS company_name
FROM ow_articles a
LEFT JOIN ow_companies c ON a.company_id = c.id
ORDER BY a.title;
