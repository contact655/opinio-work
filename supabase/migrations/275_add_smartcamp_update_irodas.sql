-- Migration 275: スマートキャンプ株式会社 INSERT + irodas culture_keywords 追記
-- 作成: 2026-07-26
-- 対象: ow_companies
-- 注意: smartcamp は is_published=false で投入、目視確認後に true へ更新すること

-- ─── Step B: スマートキャンプ株式会社 INSERT ───────────────────────────────

INSERT INTO ow_companies (
  slug, name, name_en, brand_name,
  tagline, mission, description,
  industry, industry_id, saas_category_id,
  phase, employee_count, founded_year, location, url, ceo_name,
  logo_url, logo_letter, logo_gradient,
  remote_work_status, flex_time, side_job_ok,
  company_features, main_products, main_customers,
  benefits, evaluation_system, culture_keywords, culture_description,
  source, listing_status, engagement_status,
  is_published, is_approved, jobs_public, accepting_casual_meetings
) VALUES (
  'smartcamp',
  'スマートキャンプ株式会社',
  'SMARTCAMP Co., Ltd.',
  'Smartcamp',
  'テクノロジーを広げ社会の生産性を飛躍させる',
  'テクノロジーを広げ社会の生産性を飛躍させる',
  'SaaS・AI企業のセールス／マーケティングを、戦略から実行まで横断して支援するBtoBプラットフォーム事業。法人向けSaaS比較サイト「BOXIL」を中核に、職種特化型オンライン展示会「BOXIL EXPO」、経営層向けカンファレンス「SMARTCAMP EVENTS」、インサイドセールス代行の「BALES」、BtoB・SaaS特化のデジタルエージェンシー「ADXL」を展開する。2014年創業。2019年にマネーフォワードのグループ会社となったのち、2025年11月に丸の内キャピタル運営ファンドへ株式が譲渡され、2026年3月に組織再編を経て現在に至る。',
  'マーケティング・セールス支援',
  '8db0ca6e-1fd8-4e0a-9282-c7ab444e4321',
  '89e81929-6e7c-4bce-9624-807cce818e6f',
  NULL,
  '約200名',
  2014,
  '東京都',
  'https://smartcamp.co.jp/',
  '林 詩音',
  NULL,
  'S',
  'linear-gradient(135deg, #1e40af, #3b82f6)',
  'hybrid',
  true,
  NULL,
  '["BOXIL運営","SOCS","カンパニー制","フレックス","ハイブリッド"]'::jsonb,
  ARRAY[
    'BOXIL（法人向けSaaS比較サイト）',
    'BOXIL EXPO（職種特化型オンライン展示会）',
    'SMARTCAMP EVENTS（経営層向けカンファレンス）',
    'BALES（インサイドセールス代行・コンサルティング）',
    'ADXL（BtoB・SaaS特化デジタルエージェンシー）',
    'BizHint（子会社運営・クラウド活用の専門サイト）'
  ],
  ARRAY['SaaS・AI企業（BtoB）'],
  ARRAY[
    '住宅手当（オフィスから1.5km圏内または通勤15分以内で月1〜2万円）',
    '引越し祝い金10万円',
    '社員紹介手当',
    '確定拠出年金',
    '予防接種手当（インフルエンザ全額会社負担）',
    'オンライン診療（ファストドクター・AndL）',
    '書籍購入制度（業務書籍全額会社負担）',
    'フレックスタイム制（コアタイム10:00〜16:00）',
    '夏季休暇3日・冬季休暇2日'
  ],
  '職種 × グレード × 半期ごとの評価で給与を決定。評価は半期に1回・7段階（前期4〜9月／後期10〜3月、評価期間中3ヶ月以上在籍者が対象）。給与には固定残業代40時間分を含み、超過分は追加支給。',
  ARRAY['日報文化','オープンな情報共有','全社集会（月1〜2回）','SOCS AWARD','部署横断コミュニティ','カンパニー制'],
  'Slack上でのオープンな情報共有と日報文化を軸に、月1〜2回の全社集会で方針を共有する。バリュー「SOCS（Smart thinking／Ownership／Collaboration／Speed）」の体現者を表彰する「SOCS AWARD」や、部署横断のコミュニティ活動がある。意思決定のスピードを重視してカンパニー制を採用。',
  'manual',
  'listed',
  'none',
  false,
  true,
  true,
  false
);

-- ─── Step C: irodas culture_keywords 追記（NULL のカラムのみ）────────────────
-- ※この部分は前回のままで正しい

UPDATE ow_companies
SET culture_keywords = '{"素直","謙虚","感謝","信頼"}'
WHERE slug = 'irodas'
  AND culture_keywords IS NULL;
