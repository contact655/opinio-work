-- Migration 154: 求職者ユーザー登録 — 生藤弘樹・小松耕野
-- 履歴書からプロフィールデータを作成
-- メールアドレスは仮設定（後から UPDATE で変更可能）
-- 招待は /admin > ユーザー招待 または UPDATE ow_users SET email = '本物のメール' WHERE name = '...'

DO $$
DECLARE
  narifuji_id UUID;
  komatsu_id  UUID;
BEGIN

  -- ===========================================================
  -- 1. 生藤 弘樹
  -- ===========================================================
  INSERT INTO ow_users (
    email, name,
    avatar_color,
    about_me,
    future_aspirations,
    visibility,
    is_open_to_work,
    is_mentor
  ) VALUES (
    'narifuji.hiroki@placeholder.opinio.jp',
    '生藤 弘樹',
    'linear-gradient(135deg, #002366 0%, #1e3a8a 100%)',
    '富士フイルム→Salesforce Japan→Flyleと、エンタープライズ新規開拓営業一筋6年。Salesforceでは全国140名中MVP複数受賞、富士フイルムでは6,000名中3位を記録。現職FlyleではARR 1億2,000万円（達成率170%）を達成。圧倒的な行動量と仮説型提案でチームに結果をもたらすフィールドセールス。',
    '営業組織のトッププレイヤーとして、エンタープライズSaaSの第一線で圧倒的な結果を出し続けること。',
    'public',
    true,
    false
  )
  RETURNING id INTO narifuji_id;

  INSERT INTO ow_profiles (
    user_id, name, job_type, experience_years,
    bio, skills, tools, onboarding_completed
  ) VALUES (
    narifuji_id,
    '生藤 弘樹',
    'フィールドセールス',
    '6年',
    '富士フイルム→Salesforce Japan→Flyleと、エンタープライズ新規開拓一筋6年。SalesforceではMVPを複数受賞し、現職FlyleではARR 1億2,000万円（達成率170%）を達成。',
    ARRAY['エンタープライズ営業', 'インサイドセールス', 'フィールドセールス', '新規開拓', 'アカウントプラン策定', '仮説型提案'],
    ARRAY['Salesforce', 'Sansan', 'HubSpot', 'Word', 'Excel', 'PowerPoint'],
    true
  );

  -- 職歴①: フライル（現職）
  INSERT INTO ow_experiences (
    user_id, company_text,
    role_category_id, role_title,
    started_at, is_current,
    description, display_order
  ) VALUES (
    narifuji_id,
    '株式会社フライル',
    '133c74c0-e432-4c52-8235-7ad9bc7d96b8', -- フィールドセールス
    'Enterprise Account Executive',
    '2024-02-01',
    true,
    'AIカスタマーニーズプラットフォーム Flyleのエンタープライズ営業。ARR 1億2,000万円達成（2025年、達成率170%）。ネスレ日本・JR東日本・HIS・アシックスジャパン等の大手企業を新規開拓。インサイドセールス立ち上げ・インターン育成も担当。',
    1
  );

  -- 職歴②: Salesforce Japan（SDR）
  INSERT INTO ow_experiences (
    user_id, company_id,
    role_category_id, role_title,
    started_at, ended_at, is_current,
    description, display_order
  ) VALUES (
    narifuji_id,
    'c3664ef1-5571-4645-b30f-1474e7961c17', -- Salesforce Japan
    'd1724303-7ca2-4cbe-a16b-f15d5a2476b8', -- インサイドセールス
    'Sales Development Representative（SDR）',
    '2022-07-01',
    '2024-01-31',
    false,
    '中小企業向けCRM・SFAのインサイドセールス（近畿エリア担当）。FY23Q3ベストルーキー、FY23Q4・FY24Q1 MVP受賞（全国140名中）。個人達成率180〜260%を継続。',
    2
  );

  -- 職歴③: 富士フイルムビジネスイノベーションジャパン
  INSERT INTO ow_experiences (
    user_id, company_text,
    role_category_id, role_title,
    started_at, ended_at, is_current,
    description, display_order
  ) VALUES (
    narifuji_id,
    '富士フイルムビジネスイノベーションジャパン株式会社',
    '133c74c0-e432-4c52-8235-7ad9bc7d96b8', -- フィールドセールス
    '営業（メジャー営業統括部 メジャーNB部）',
    '2019-04-01',
    '2022-07-31',
    false,
    'エンタープライズ〜中小企業向けクラウドサービス・OA機器の新規開拓営業（大阪担当）。2022年度下期 全国6,000人中3位。売上1億2,000万円（達成率400%）を記録。CRM/グループウェアのソリューション提案も担当。',
    3
  );

  -- スキルタグ
  INSERT INTO ow_user_skill_tags (user_id, label, sort_order) VALUES
    (narifuji_id, 'エンタープライズ営業',   1),
    (narifuji_id, 'インサイドセールス',     2),
    (narifuji_id, 'フィールドセールス',     3),
    (narifuji_id, '新規開拓',              4),
    (narifuji_id, 'Salesforce',           5),
    (narifuji_id, '仮説型提案',            6);


  -- ===========================================================
  -- 2. 小松 耕野
  -- ===========================================================
  INSERT INTO ow_users (
    email, name,
    avatar_color,
    about_me,
    future_aspirations,
    visibility,
    is_open_to_work,
    is_mentor
  ) VALUES (
    'komatsu.kono@placeholder.opinio.jp',
    '小松 耕野',
    'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
    'アサヒビール→Salesforce Japan（SDR/BDR→AE）→New Relic→Flyleと、9年間で一貫してアウトバウンド起点の新規顧客開拓を推進。SDR/BDR時代に全国1位の有効商談創出を達成し、現職FlyleではAE6名中トップのARRを創出。MEDDICを活用したチームセリングが強み。',
    'アウトバウンドとチームセリングを武器に、より大きなマーケットで日本のDXをさらに加速させること。',
    'public',
    true,
    false
  )
  RETURNING id INTO komatsu_id;

  INSERT INTO ow_profiles (
    user_id, name, job_type, experience_years,
    bio, skills, tools, onboarding_completed
  ) VALUES (
    komatsu_id,
    '小松 耕野',
    'フィールドセールス',
    '9年',
    'アサヒビール→Salesforce Japan→New Relic→Flyleと9年間、アウトバウンド起点の新規顧客開拓を強みに活躍。SDR/BDR時代に全国1位（有効商談創出）を記録し、現職FlyleではAE6名中トップのARRを創出。',
    ARRAY['エンタープライズ営業', 'アウトバウンド営業', 'MEDDIC', 'チームセリング', '新規顧客開拓', 'Pipeline創出'],
    ARRAY['Salesforce', 'Google Slide', 'Slack', 'PowerPoint', 'Word', 'Excel', 'ChatGPT', 'Gemini', 'Perplexity'],
    true
  );

  -- 職歴①: Flyle（現職）
  INSERT INTO ow_experiences (
    user_id, company_text,
    role_category_id, role_title,
    started_at, is_current,
    description, display_order
  ) VALUES (
    komatsu_id,
    '株式会社Flyle',
    '133c74c0-e432-4c52-8235-7ad9bc7d96b8', -- フィールドセールス
    'エンタープライズ アカウントエグゼクティブ',
    '2025-02-01',
    true,
    'エンタープライズ企業（従業員1,000名以上・売上300億以上）向けAIインサイトプラットフォームの新規導入提案。AE6名中トップのARR創出。日本郵政・日本郵便、キューサイ、カシオ計算機、ニップン、ドームへ新規導入。トータルARR 5,838万円。',
    1
  );

  -- 職歴②: New Relic
  INSERT INTO ow_experiences (
    user_id, company_text,
    role_category_id, role_title,
    started_at, ended_at, is_current,
    description, display_order
  ) VALUES (
    komatsu_id,
    'New Relic株式会社',
    '133c74c0-e432-4c52-8235-7ad9bc7d96b8', -- フィールドセールス
    'アカウントエグゼクティブ（エンタープライズ第一グループ）',
    '2024-07-01',
    '2025-01-31',
    false,
    '商社・SaaS業界向けオブザーバビリティSaaSの新規顧客獲得。アウトバウンドアプローチでマクニカ・スパイダープラス・ヌーラボの大型商談を創出（ARR 9,000万円規模）。MEDDICを活用し商談推進。',
    2
  );

  -- 職歴③: Salesforce Japan（AE）
  INSERT INTO ow_experiences (
    user_id, company_id,
    role_category_id, role_title,
    started_at, ended_at, is_current,
    description, display_order
  ) VALUES (
    komatsu_id,
    'c3664ef1-5571-4645-b30f-1474e7961c17', -- Salesforce Japan
    '133c74c0-e432-4c52-8235-7ad9bc7d96b8', -- フィールドセールス
    'アカウントエグゼクティブ（コマーシャル営業 関西DX推進営業部）',
    '2022-05-01',
    '2024-07-31',
    false,
    'SB領域（5〜30名規模）の新規・既存顧客営業。FY23テリトリーARR YoY+250%達成。FY24チーム14名中3位（ACV 261K）、Q3 Pinnacle Award受賞。New Logo Quota 132%達成。進行中商談活動量チーム1位。',
    3
  );

  -- 職歴④: Salesforce Japan（SDR/BDR）
  INSERT INTO ow_experiences (
    user_id, company_id,
    role_category_id, role_title,
    started_at, ended_at, is_current,
    description, display_order
  ) VALUES (
    komatsu_id,
    'c3664ef1-5571-4645-b30f-1474e7961c17', -- Salesforce Japan
    'd1724303-7ca2-4cbe-a16b-f15d5a2476b8', -- インサイドセールス
    'SDR / BDR（エンタープライズ事業部）',
    '2020-10-01',
    '2022-04-30',
    false,
    '電話/手紙/メールで有効商談を獲得するインサイドセールス。全在籍期間KPI達成（9ヶ月連続）。FY22商談発掘数全国1位（356件）、有効商談創出数全国1位（221件）。Best Rookie賞・MVP賞・副社長賞受賞。',
    4
  );

  -- 職歴⑤: アサヒビール
  INSERT INTO ow_experiences (
    user_id, company_text,
    role_category_id, role_title,
    started_at, ended_at, is_current,
    description, display_order
  ) VALUES (
    komatsu_id,
    'アサヒビール株式会社',
    '6938712f-0b29-4682-ac6e-ad112734a3f1', -- 営業
    '営業（大阪統括支社 大阪南支店）副主任',
    '2017-04-01',
    '2020-09-30',
    false,
    '担当酒販店・料飲店向け総合酒類の拡販営業。史上最年少でTop TierのグランマルシェT（酒販店）を担当。2018年度売上14億円（110%）、2019年度15億円（113%）達成。',
    5
  );

  -- スキルタグ
  INSERT INTO ow_user_skill_tags (user_id, label, sort_order) VALUES
    (komatsu_id, 'エンタープライズ営業',   1),
    (komatsu_id, 'アウトバウンド営業',     2),
    (komatsu_id, 'MEDDIC',               3),
    (komatsu_id, 'チームセリング',         4),
    (komatsu_id, 'Salesforce',           5),
    (komatsu_id, 'Pipeline創出',          6);

  -- 学歴（小松のみ）
  INSERT INTO ow_user_educations (
    user_id, school, faculty, degree,
    enrolled_at, graduated_at, is_current, sort_order
  ) VALUES (
    komatsu_id,
    '同志社大学',
    '心理学部心理学科（発達心理学専攻）',
    '学士',
    '2013-04-01',
    '2017-03-31',
    false,
    1
  );

END $$;
