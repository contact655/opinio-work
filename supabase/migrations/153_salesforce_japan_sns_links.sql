-- Migration 153: Salesforce Japan 公式SNS・発信チャンネル登録
-- ow_company_external_links に Salesforce Japan の公式SNSアカウントを登録

INSERT INTO ow_company_external_links (
  id,
  company_id,
  url,
  type,
  title,
  description,
  source_name,
  thumbnail_url,
  is_published,
  sort_order,
  created_by_role,
  created_at,
  updated_at
) VALUES

-- X (Twitter) @SalesforceJapan
(
  gen_random_uuid(),
  'c3664ef1-5571-4645-b30f-1474e7961c17',
  'https://twitter.com/SalesforceJapan',
  'social',
  'Salesforce Japan 公式 X（旧Twitter）',
  '最新製品情報・イベント情報・社員の声をリアルタイムで発信。Agentforce・Trailblazer Communityの最新ニュースも随時配信中。',
  'X @SalesforceJapan',
  NULL,
  true,
  1,
  'editor',
  NOW(),
  NOW()
),

-- LinkedIn
(
  gen_random_uuid(),
  'c3664ef1-5571-4645-b30f-1474e7961c17',
  'https://www.linkedin.com/company/salesforce/',
  'social',
  'Salesforce 公式 LinkedIn',
  'グローバル・日本の採用情報、社員インタビュー、カルチャー紹介を発信。転職を検討している方は要チェック。',
  'LinkedIn @Salesforce',
  NULL,
  true,
  2,
  'editor',
  NOW(),
  NOW()
),

-- YouTube
(
  gen_random_uuid(),
  'c3664ef1-5571-4645-b30f-1474e7961c17',
  'https://www.youtube.com/@SalesforceJapan',
  'video',
  'Salesforce Japan 公式 YouTube',
  '製品デモ動画・ウェビナーアーカイブ・導入事例インタビューを多数公開。Agentforce の実演動画も必見。',
  'YouTube @SalesforceJapan',
  NULL,
  true,
  3,
  'editor',
  NOW(),
  NOW()
),

-- 公式ブログ
(
  gen_random_uuid(),
  'c3664ef1-5571-4645-b30f-1474e7961c17',
  'https://www.salesforce.com/jp/blog/',
  'article',
  'Salesforce Japan 公式ブログ',
  'AI・CRM・DXの最新トレンド、導入企業のインタビュー、製品活用ノウハウを日本語で発信。',
  'Salesforce Japan Blog',
  NULL,
  true,
  4,
  'editor',
  NOW(),
  NOW()
),

-- Facebook
(
  gen_random_uuid(),
  'c3664ef1-5571-4645-b30f-1474e7961c17',
  'https://www.facebook.com/SalesforceJapan/',
  'social',
  'Salesforce Japan 公式 Facebook',
  'イベントレポートや社内の様子など、X とは異なる切り口で Salesforce Japan のリアルを発信。',
  'Facebook @SalesforceJapan',
  NULL,
  true,
  5,
  'editor',
  NOW(),
  NOW()
);
