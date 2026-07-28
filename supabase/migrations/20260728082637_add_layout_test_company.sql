-- ─────────────────────────────────────────────────────────────────────────────
-- layout-test 企業: 全セクション表示確認用テストデータ（2026-07-28）
--
-- 目的: 企業詳細ページ（/companies/[id]）の全セクションを一画面で確認する
-- 安全設計:
--   - is_published = false → 本番では 404（dev 環境のみアクセス可）
--   - 社名・親会社名・導入事例 は「明らかに架空」と分かる表記
--   - UUIDはすべて固定値（削除 migration で確実にクリーンアップできる）
--
-- 固定 UUID: a0a0a0a0-0000-4000-8000-000000000001
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  cid UUID := 'a0a0a0a0-0000-4000-8000-000000000001';
BEGIN

-- ── 1. ow_companies ─────────────────────────────────────────────────────────
INSERT INTO ow_companies (
  id, name, slug, tagline, mission, description, why_join,
  phase, capital_type, industry, employee_count, founded_year,
  location, headquarters_address, url, is_published, accepting_casual_meetings, remote_work_status,
  biz_model_types, biz_model_note,
  market_customer_size, market_decision_maker, market_note,
  main_products, main_customers,
  parent_company_name, parent_company_country, listed_exchange, capital_notes, global_employee_count,
  branch_locations,
  avg_salary, avg_age, paid_leave_rate, avg_overtime_hours, female_ratio, funding_total, numbers_updated_at,
  work_time_system, nearest_station, workstyle_description, benefits, evaluation_system,
  culture_description, culture_keywords,
  fit_positives, fit_negatives, show_fit_negatives,
  -- ※ fit_positives / fit_negatives は jsonb 型（text[] ではない）
  org_teams, customer_cases
) VALUES (
  cid,
  'テスト企業（レイアウト確認用）',
  'layout-test',
  'これはレイアウト確認専用のテストデータです',
  '全セクションが正しく表示されることを確認する',
  'このページは企業詳細ページの全セクション表示確認を目的として作成したテストデータです。実在の企業・人物・数値とは一切関係ありません。社名・製品名・導入事例・社員情報はすべて架空の値です。',
  'テスト企業には実在の社員がいません。このページはレイアウト確認専用です。',
  'series_b',
  'japanese_independent',
  'SaaS',
  999,
  2099,
  '東京都テスト区テスト町1-2-3',
  '〒000-0000 東京都テスト区テスト町1-2-3 テストビル99F',
  'https://example.com',
  false,
  true,
  'hybrid',
  ARRAY['subscription', 'usage'],
  'テスト用ビジネスモデルの説明文です。サブスクリプションと従量課金のハイブリッドモデルを採用しています（架空）。',
  ARRAY['enterprise', 'mid_market'],
  '情報システム部門・CTO',
  'テスト用マーケット説明。国内SaaS市場をターゲットとする架空の記述です。',
  ARRAY['テストプロダクトA', 'サンプルサービスB'],
  ARRAY['株式会社サンプル商事', 'テスト工業株式会社', '架空フィンテック株式会社'],
  'テスト・ホールディングス株式会社',
  '日本',
  'テスト証券取引所',
  '資本関係に関するテスト用補足説明です（架空）。',
  '9,999名（テスト値）',
  ARRAY['東京都テスト区（本社）', '大阪府テスト市', '愛知県テスト市'],
  '999万円',
  33,
  99,
  '9.9時間',
  '49%',
  '99億円（累計・架空）',
  NOW(),
  'スーパーフレックスタイム制（コアタイムなし）',
  'テスト駅 徒歩1分',
  '週3〜4日リモートワーク可。チームによって異なります（架空）。',
  ARRAY['テスト手当（月9,999円）', '書籍購入補助（年99,999円）', 'ランチ補助（1食999円）', 'フィットネスクラブ補助', '副業OK', '育児休業取得率99%', 'リモートワーク手当'],
  'テスト用評価制度の説明。半期ごとにOKRで評価し、360度フィードバックを実施します（架空）。',
  'テスト用カルチャー説明。スピードと品質を両立する文化を重視しています（架空）。',
  ARRAY['スピード重視', '透明性', 'オーナーシップ', '顧客第一'],
  '["テスト: 裁量が大きい", "テスト: リモートワーク可", "テスト: 成長市場"]'::jsonb,
  '["テスト: 変化が激しい", "テスト: 制度が未整備"]'::jsonb,
  true,
  '[
    {
      "name": "テスト営業チーム",
      "en_name": "Sample Sales",
      "division": "Sales",
      "mission": "架空の営業ミッションです",
      "description": "このチームはレイアウト確認用の架空チームです。実在しません。",
      "roles": ["Sample Account Executive", "Test Sales Development Rep"]
    },
    {
      "name": "テスト開発チーム",
      "en_name": "Sample Engineering",
      "division": "Engineering",
      "mission": "架空の開発ミッションです",
      "description": "このチームもレイアウト確認用の架空チームです。実在しません。",
      "roles": ["Sample Backend Engineer", "Test Frontend Engineer"]
    }
  ]'::jsonb,
  '[
    {
      "name": "株式会社サンプル商事",
      "industry": "卸売業（架空）",
      "usecase": "テスト用ユースケースの説明です。実在する導入事例ではありません。",
      "result": "テスト: 業務効率が架空の数値で99%改善しました。",
      "products": ["テストプロダクトA", "サンプルサービスB"]
    },
    {
      "name": "架空フィンテック株式会社",
      "industry": "金融（架空）",
      "usecase": "テスト用ユースケース2。こちらも架空の記述です。",
      "result": "テスト: コスト削減が架空の数値で達成されました。",
      "products": ["テストプロダクトA"]
    }
  ]'::jsonb
);

-- ── 2. ow_jobs（3件・異なるカテゴリ） ───────────────────────────────────────
INSERT INTO ow_jobs (
  company_id, title, job_category, work_style, employment_type,
  location, salary_min, salary_max,
  catch_copy, description, requirements,
  selection_process, why_hire, status, published_at
) VALUES
(
  cid, 'テスト: セールスポジション', '営業', 'hybrid', '正社員',
  '東京都テスト区', 600, 900,
  'テスト求人です（架空）',
  'これはレイアウト確認専用のテスト求人です。実在する求人ではありません。',
  'テスト要件: 架空の条件が入ります。',
  NULL,
  'テスト: なぜこのポジションに入社するか（架空）',
  'published', NOW()
),
(
  cid, 'テスト: エンジニアポジション', 'エンジニア', 'remote', '正社員',
  '東京都テスト区（フルリモート可）', 700, 1100,
  'テストエンジニア求人（架空）',
  'エンジニア向けのレイアウト確認用テスト求人です。',
  'テスト要件: バックエンド・フロントエンドいずれか（架空）',
  NULL,
  'テスト: エンジニアとして入社する理由（架空）',
  'published', NOW()
),
(
  cid, 'テスト: マーケティングポジション', 'マーケティング', 'hybrid', '正社員',
  '東京都テスト区', 500, 800,
  'テストマーケ求人（架空）',
  'マーケティング向けレイアウト確認用テスト求人です。',
  'テスト要件: デジタルマーケティング経験者（架空）',
  NULL, NULL,
  'published', NOW()
);

-- ── 3. ow_company_tools（10カテゴリ × 各1件） ────────────────────────────────
INSERT INTO ow_company_tools (company_id, tool_id, sort_order, note) VALUES
(cid, 'e7c7b71d-adba-4210-8cb8-570c0209139a', 10, 'AI活用テスト（架空）'),  -- ai: ChatGPT
(cid, 'fbe3a154-75f5-4d24-ac38-551a0f6c4eb3', 20, NULL),                     -- calendar: Google カレンダー
(cid, 'd559c80c-a2c8-4c13-b169-a39f0db1c1b5', 30, NULL),                     -- communication: Slack
(cid, '96f25601-d4c7-4bed-9c67-d371c234ca7c', 40, 'CRMテスト（架空）'),     -- crm: Salesforce
(cid, '62a239aa-0e70-4be0-870c-4170672dbc6e', 50, NULL),                     -- data: Tableau
(cid, '0569e780-f70c-4159-bd8c-1d5e0cfc2cfa', 60, NULL),                     -- dev: GitHub
(cid, 'bd077dbf-df1b-4806-98b9-63652136cbc1', 70, NULL),                     -- email: Gmail
(cid, 'a5e075d7-5805-4aa8-a8e4-aeb4d46560e9', 80, NULL),                     -- marketing: Google Analytics
(cid, 'a34b134c-9817-4472-8cad-6c2ebf692ee9', 90, NULL),                     -- other: Notion
(cid, '2071f262-7645-4a4f-a2b4-fdb3cf4bea62', 100, NULL);                    -- sales: Outreach

-- ── 4. ow_salary_reports（3件・is_approved=true → SALARY_STATS_MIN=3 達成） ──
INSERT INTO ow_salary_reports (
  company_id, role_id, years_of_experience,
  annual_salary, employment_status, prefecture,
  start_year_month, end_year_month, proxy_note, is_approved
) VALUES
(
  cid, '6938712f-0b29-4682-ac6e-ad112734a3f1', 3,
  7000000, 'current', '東京都', '2022-04', NULL,
  'テスト給与データ（架空・営業）', true
),
(
  cid, 'c8140123-e29a-43b3-9dbf-1a3d21a68966', 5,
  9000000, 'current', '東京都', '2020-07', NULL,
  'テスト給与データ（架空・エンジニア）', true
),
(
  cid, '38429140-f784-44c0-8eec-407495044272', 2,
  6000000, 'alumni', '東京都', '2021-01', '2023-06',
  'テスト給与データ（架空・マーケ・退職済み）', true
);

-- ── 5. ow_company_office_photos（各カテゴリ1枚） ─────────────────────────────
INSERT INTO ow_company_office_photos (company_id, category, image_url, caption, display_order) VALUES
(cid, 'workspace', 'https://placehold.co/800x600/002366/ffffff?text=TEST+workspace', 'テスト: オフィス写真（架空）', 1),
(cid, 'meeting',   'https://placehold.co/800x600/3B5FD9/ffffff?text=TEST+meeting',   'テスト: 会議室写真（架空）', 2),
(cid, 'welfare',   'https://placehold.co/800x600/059669/ffffff?text=TEST+welfare',   'テスト: 福利厚生写真（架空）', 3),
(cid, 'event',     'https://placehold.co/800x600/F59E0B/ffffff?text=TEST+event',     'テスト: イベント写真（架空）', 4);

-- ── 6. ow_company_posts（1件・公開） ─────────────────────────────────────────
INSERT INTO ow_company_posts (company_id, title, body, category, is_published, published_at) VALUES
(
  cid,
  '【テスト】ストーリー表示確認用（架空記事）',
  'このストーリーはレイアウト確認専用のテストデータです。実在する記事ではありません。

テスト本文の1段落目です。ストーリーセクションに本文が表示されることを確認します。

テスト本文の2段落目です。改行が正しく表示されることを確認します。',
  'interview',
  true,
  NOW()
);

END $$;
