-- ============================================
-- Phase 3-A: テストメンター 10 名分の経歴データ投入（修正版）
-- 実際のスキーマに合わせて role_category_id を ow_roles から参照
-- ============================================

-- ステップ 0: 既存のテストメンター経歴をクリーンアップ
DELETE FROM ow_experiences
WHERE user_id IN (
  SELECT id FROM ow_users WHERE email LIKE 'test-mentor-%@opinio.local'
);

-- ============================================
-- ステップ 1: 経歴を INSERT
-- 各メンター 2-3 件（前職 + 現職、または前々職 + 前職 + 現職）
-- role_category_id は ow_roles.name から動的に解決
-- ============================================

INSERT INTO ow_experiences (
  id, user_id, company_id, company_text, company_anonymized,
  role_category_id, role_title,
  started_at, ended_at, is_current,
  description, display_order,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  NULL,
  data.company_text,
  NULL,
  r.id,                       -- ow_roles から解決
  data.role_title,
  data.started_at,
  data.ended_at,
  data.is_current,
  data.description,
  data.disp_order,
  NOW(),
  NOW()
FROM ow_users u
JOIN (VALUES
  -- 01: 田中 健太郎（営業 → PdM）
  ('test-mentor-01@opinio.local', '株式会社 大手 SIer',          '法人営業',                   'inside_outside_sales', '2014-04-01'::date, '2020-03-31'::date, false, '大手 SIer で 6 年間、エンタープライズ向け提案営業',                   10),
  ('test-mentor-01@opinio.local', '株式会社カミナシ',            'プロダクトマネージャー',     'product',              '2020-04-01'::date, NULL,               true,  '現職 PdM 4年。BtoB SaaS の機能開発を統括',                            20),

  -- 02: 佐藤 由香（コンサル → CSM）
  ('test-mentor-02@opinio.local', 'コンサルティングファーム',    'シニアコンサルタント',       'corporate',            '2015-04-01'::date, '2021-03-31'::date, false, 'BtoB 戦略コンサル 6 年。出産・育休を経て事業会社に転身',              10),
  ('test-mentor-02@opinio.local', '株式会社マネーフォワード',    'カスタマーサクセスマネージャー','customer_success',     '2022-04-01'::date, NULL,               true,  '現職 CSM 3年。ハイタッチ CS の組織立ち上げ',                          20),

  -- 03: 鈴木 翔太（エンジニア → CTO → EM）
  ('test-mentor-03@opinio.local', '株式会社 大手 Web 企業',       'バックエンドエンジニア',    'engineering',          '2012-04-01'::date, '2018-12-31'::date, false, '新卒入社で 7 年、Web サービス開発',                                  10),
  ('test-mentor-03@opinio.local', '株式会社 スタートアップA',     'CTO',                       'cxo',                  '2019-01-01'::date, '2023-12-31'::date, false, 'シードからシリーズ B まで技術組織を構築',                            20),
  ('test-mentor-03@opinio.local', '株式会社SmartHR',              'エンジニアリングマネージャー','engineering',          '2024-01-01'::date, NULL,               true,  '現職 EM 2年。10名規模のチーム運営',                                  30),

  -- 04: 山田 美咲（広告代理店 → 事業会社マーケ）
  ('test-mentor-04@opinio.local', '株式会社 広告代理店',          'アカウントプランナー',     'marketing',            '2017-04-01'::date, '2022-09-30'::date, false, '広告代理店で大手クライアント担当',                                   10),
  ('test-mentor-04@opinio.local', '株式会社LayerX',               'マーケティングマネージャー','marketing',            '2022-10-01'::date, NULL,               true,  '現職 Mktg Mgr 3年。BtoB マーケの戦略立案',                          20),

  -- 05: 高橋 大輔（外資 IT → 日系 SaaS）
  ('test-mentor-05@opinio.local', '外資系 IT 企業',                'インサイドセールス',       'inside_outside_sales', '2013-04-01'::date, '2017-03-31'::date, false, '外資 IT で IS 立ち上げ',                                            10),
  ('test-mentor-05@opinio.local', '外資系 IT 企業',                'フィールドセールス',       'inside_outside_sales', '2017-04-01'::date, '2020-03-31'::date, false, '同社で FS 昇格。エンタープライズ商談',                              20),
  ('test-mentor-05@opinio.local', '株式会社Sansan',                '営業マネージャー',         'inside_outside_sales', '2020-04-01'::date, NULL,               true,  '現職 Sales Mgr 5年。組織化を推進',                                  30),

  -- 06: 伊藤 沙織（制作 → 事業会社デザイナー）
  ('test-mentor-06@opinio.local', '株式会社 制作会社',             'Web デザイナー',           'designer',             '2016-04-01'::date, '2020-12-31'::date, false, '受託制作 5 年',                                                     10),
  ('test-mentor-06@opinio.local', '株式会社カオナビ',              'プロダクトデザイナー',     'designer',             '2021-01-01'::date, NULL,               true,  '現職 デザイナー 4年。新規プロダクト UI 設計',                       20),

  -- 07: 渡辺 雄一（TL → EM → VPoE）
  ('test-mentor-07@opinio.local', '株式会社 スタートアップB',     'テックリード',              'engineering',          '2014-04-01'::date, '2019-03-31'::date, false, 'スタートアップで TL 兼組織設計',                                    10),
  ('test-mentor-07@opinio.local', '株式会社マネーフォワード',     'エンジニアリングマネージャー','engineering',          '2019-04-01'::date, '2023-03-31'::date, false, '同社で EM。20 名規模',                                              20),
  ('test-mentor-07@opinio.local', '株式会社マネーフォワード',     'VPoE',                      'cxo',                  '2023-04-01'::date, NULL,               true,  '現職 VPoE 2年。50 名規模のエンジニア組織',                         30),

  -- 08: 中村 茉莉（人材エージェント → HRBP）
  ('test-mentor-08@opinio.local', '株式会社 人材紹介エージェント','キャリアアドバイザー',     'corporate',            '2018-04-01'::date, '2023-03-31'::date, false, 'IT/SaaS 領域のキャリアアドバイザー 5 年',                          10),
  ('test-mentor-08@opinio.local', '株式会社FOLIO',                 'HRBP',                      'corporate',            '2023-04-01'::date, NULL,               true,  '現職 HRBP 2年。事業部に伴走',                                       20),

  -- 09: 小林 慎吾（コンサル PMO → PO）
  ('test-mentor-09@opinio.local', 'コンサルティングファーム',     'PMO コンサルタント',       'corporate',            '2014-04-01'::date, '2022-03-31'::date, false, 'コンサルで大手 PMO 8 年',                                          10),
  ('test-mentor-09@opinio.local', '株式会社カオナビ',              'プロダクトオーナー',       'product',              '2022-04-01'::date, NULL,               true,  '現職 PO 3年。プロダクト戦略の策定',                                20),

  -- 10: 加藤 真理子（営業 → CS）
  ('test-mentor-10@opinio.local', '株式会社 大手 IT サービス',    'フィールドセールス',       'inside_outside_sales', '2015-04-01'::date, '2020-12-31'::date, false, '営業 6 年。CS への関心が高まり転身',                                10),
  ('test-mentor-10@opinio.local', '株式会社freee',                 'カスタマーサクセス',       'customer_success',     '2021-01-01'::date, NULL,               true,  '現職 CS 4年。中小企業向けハイタッチ',                              20)

) AS data(email, company_text, role_title, role_key, started_at, ended_at, is_current, description, disp_order)
ON u.email = data.email
JOIN ow_roles r ON r.name = CASE data.role_key
  WHEN 'product'              THEN 'プロダクト'
  WHEN 'customer_success'     THEN 'カスタマーサクセス'
  WHEN 'engineering'          THEN 'エンジニア'
  WHEN 'marketing'            THEN 'マーケティング'
  WHEN 'inside_outside_sales' THEN '営業'
  WHEN 'designer'             THEN 'デザイナー'
  WHEN 'corporate'            THEN 'コーポレート'
  WHEN 'cxo'                  THEN '経営・CxO'
  ELSE 'その他'
END
AND r.parent_id IS NULL;  -- トップレベル（カテゴリ）のみマッチさせる

-- ============================================
-- 検証クエリ
-- ============================================

-- ① メンターごとの経歴件数
SELECT u.name, u.email, COUNT(e.id) AS experience_count
FROM ow_users u
LEFT JOIN ow_experiences e ON e.user_id = u.id
WHERE u.email LIKE 'test-mentor-%@opinio.local'
GROUP BY u.id, u.name, u.email
ORDER BY u.email;

-- ② 現職フラグ確認（各メンター is_current=true が 1 件あること）
SELECT u.email, e.company_text, e.role_title, r.name AS role_category, e.is_current
FROM ow_users u
JOIN ow_experiences e ON e.user_id = u.id
JOIN ow_roles r ON r.id = e.role_category_id
WHERE u.email LIKE 'test-mentor-%@opinio.local'
  AND e.is_current = true
ORDER BY u.email;
