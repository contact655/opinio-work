-- Migration 184: 株式会社TEST サンプルデータ充実
-- ID: 4039a638-229d-421c-b8be-c2835bf0b9c7

UPDATE ow_companies SET
  -- 基本情報
  mission            = '採用の質を上げて、組織と個人の可能性を広げる。',
  tagline            = '中堅・大企業の採用を変える、クラウドATSプラットフォーム',
  phase              = 'シリーズB',
  employee_count     = '180名',
  founded_year       = 2018,
  location           = '東京都渋谷区渋谷2丁目',
  headquarters_address = '東京都渋谷区渋谷2-21-1 渋谷ヒカリエ18F',
  nearest_station    = '渋谷駅 徒歩3分（東口）',
  url                = 'https://example-test.co.jp',
  careers_url        = 'https://example-test.co.jp/careers',
  ceo_name           = '山田 太郎',
  funding_total      = '累計30億円',
  arr_scale          = '10億円規模',
  engineer_ratio     = '40%',

  -- 数値データ
  avg_salary         = '700万円',
  avg_age            = 31,
  female_ratio       = '45%',
  female_manager_ratio = 30,
  avg_overtime_hours = '月平均20時間以内',
  annual_holiday_days = 125,
  mid_career_ratio   = 85,
  avg_tenure_years   = '2.8年',
  avg_selection_weeks = 4,
  selection_count    = 4,
  remote_rate        = 70,
  paid_leave_rate    = 75,
  maternity_leave_female = 100,
  maternity_leave_male = 60,

  -- 働き方
  remote_work_status = 'remote_ok',
  flex_time          = true,
  core_time          = 'なし（フルフレックス）',
  office_days_per_week = '週1〜2日（任意）',
  side_job_ok        = true,
  has_stock_option   = true,
  has_incentive      = true,
  incentive_detail   = '四半期インセンティブ（営業・CS）',
  bonus_times        = 2,
  salary_review_times = 2,
  evaluation_cycle   = '半期（4月・10月）',
  has_book_allowance = true,
  has_learning_support = true,
  has_meal_allowance = true,
  has_housing_allowance = false,
  has_health_support = true,
  has_internal_transfer = true,
  english_frequency  = '一部業務で英語使用（グローバルベンダーとの連携）',
  autonomy_level     = '高い（個人の裁量が大きい）',
  one_on_one_freq    = '週1回（マネージャーと）',
  annual_hire_count  = '30〜40名',

  -- 選考フロー
  selection_flow     = ARRAY['書類選考', 'カジュアル面談（任意）', '一次面接（現場）', '二次面接（マネージャー）', '最終面接（役員）', 'オファー'],

  -- about
  about_markdown     = E'## 私たちについて\n\n株式会社TESTは、中堅・大企業の採用担当者が「直感的に使えて、成果につながる」採用管理プラットフォーム「TESTworks」を提供しています。\n\n従業員500名以上の企業を中心に、製造・小売・金融・サービス業など幅広い業界に導入いただいており、現在500社以上でご活用いただいています。\n\n## 私たちが解決する課題\n\n採用担当者の多くは、スプレッドシート管理・メール対応・社内調整に追われ、本来集中すべき「候補者との対話」に時間を割けていません。私たちはこの非効率を根本から解消し、採用担当者が候補者体験の向上に集中できる環境を作ることを目指しています。\n\n## プロダクトの強み\n\n- **ATS（採用管理）**: 求人票作成から内定通知まで、採用プロセス全体を一元管理\n- **採用CRM**: 候補者データベースと人材プールの構築・活用\n- **レポーティング**: 採用コスト・歩留まり・ソース別ROIをリアルタイム可視化\n- **連携**: Indeed・LinkedIn・各種求人媒体とのAPI連携を標準装備\n\n## チームカルチャー\n\n「自律・信頼・成果」を大切にしています。フルリモート・フルフレックスを前提とした働き方で、アウトプットで評価される文化です。月1回の全社オフサイトで対面のコミュニケーションも大切にしています。',

  -- 入社する理由・魅力
  why_join           = 'HRTechという成長市場で、シリーズBの急成長フェーズに参画できます。ストックオプション付与あり、フルリモート・フルフレックス、半期2回の昇給機会と、成果を出した人が報われる環境です。エンジニア比率40%・平均年齢31歳のフラットな組織で、個人の裁量が大きく意思決定スピードも速い。',

  -- カルチャー
  culture_keywords   = ARRAY['自律・成果主義', 'フルリモートOK', 'フラットな組織', '技術投資に積極的', 'スピード感', 'ユーザーファースト'],
  culture_description = 'ミーティングは必要最小限。テキストでの非同期コミュニケーションを基本としつつ、月1回の全社オフサイトで関係性を深めます。役職問わず誰でも意見を発言できる雰囲気で、優れたアイデアは即採用されます。',
  management_style   = '目標は個人が自ら設定し、マネージャーとの週1 1on1でアラインします。マイクロマネジメントは行わず、アウトプットで評価します。',

  -- 福利厚生
  benefits           = ARRAY[
    'フルリモートワーク可',
    'フルフレックス制（コアタイムなし）',
    'ストックオプション付与',
    '書籍・学習費用補助（月1万円）',
    '健康診断・ストレスチェック',
    'ランチ補助（1食500円）',
    '副業・兼業OK',
    '育児・介護休暇（取得率100%）',
    '男性育休取得推奨（取得率60%）',
    '各種社会保険完備',
    '確定拠出年金',
    'MacBook Pro支給',
    'オフィスチェア・ディスプレイ補助（在宅）',
    '月1回 全社オフサイト開催'
  ],

  -- Fit感
  fit_positives      = '["シリーズBのグロースフェーズでSOが取れる", "フルリモート×フルフレックスで働きやすい", "HRTechという成長市場で市場価値を高められる", "平均年齢31歳のフラットな組織でスピード感がある", "半期2回の昇給機会があり成果が報酬に直結する"]'::jsonb,
  fit_negatives      = '["急成長フェーズのため制度・プロセスが整備途上", "フルリモートが基本のため自己管理が求められる", "スタートアップのため大企業のような手厚い研修体制はない"]'::jsonb,

  -- 採用担当者メッセージ
  recruiter_name     = '鈴木 花子',
  recruiter_role     = '採用・人事責任者',
  recruiter_message  = '採用チームでは、「この人と一緒に働きたい」と思える方に出会いたいと考えています。まずはカジュアル面談で、TESTのカルチャーや事業の面白さをお伝えできれば嬉しいです。お気軽にご連絡ください！',

  -- 組織チーム
  org_teams          = '[
    {
      "name": "プロダクト開発",
      "en_name": "Product Engineering",
      "division": "Engineering",
      "mission": "ユーザーが毎日使いたくなるプロダクトを作る",
      "roles": ["バックエンドエンジニア", "フロントエンドエンジニア", "フルスタックエンジニア", "SRE"],
      "description": "Ruby on Rails × React を中心としたスタック。週1回のスプリントレビューで全員がプロダクトの方向性を把握しながら開発を進めます。エンジニアがPRDレビューに参加し、仕様策定から関わる文化があります。"
    },
    {
      "name": "プロダクト企画",
      "en_name": "Product Management",
      "division": "Product",
      "mission": "ユーザーの課題を深く理解し、最高のプロダクト体験を設計する",
      "roles": ["プロダクトマネージャー", "UXデザイナー"],
      "description": "月20件以上のユーザーインタビューを実施し、実際の採用担当者の声をプロダクトに反映しています。データと定性フィードバックを組み合わせた意思決定が特徴です。"
    },
    {
      "name": "エンタープライズ営業",
      "en_name": "Enterprise Sales",
      "division": "Sales",
      "mission": "従業員1,000名以上の大手企業への導入を推進する",
      "roles": ["アカウントエグゼクティブ", "SDR/BDR"],
      "description": "ターゲットは従業員1,000名以上の中堅・大企業。1案件あたりの受注規模は年間300〜1,500万円。コンサルティング型の提案スキルが求められます。"
    },
    {
      "name": "カスタマーサクセス",
      "en_name": "Customer Success",
      "division": "CS",
      "mission": "導入企業の採用成果を最大化し、解約ゼロを目指す",
      "roles": ["カスタマーサクセスマネージャー", "オンボーディングスペシャリスト"],
      "description": "1人のCSMが約30社を担当。導入後3ヶ月のオンボーディング期間で定着率を高め、その後は活用支援・アップセルを担います。NRR（純収益維持率）120%を目標としています。"
    },
    {
      "name": "コーポレート",
      "en_name": "Corporate",
      "division": "Corporate",
      "mission": "会社の成長基盤を支え、全社員が力を発揮できる環境をつくる",
      "roles": ["HR・採用", "財務・経理", "法務"],
      "description": "採用・人事・法務・経理を担う少数精鋭チーム。シリーズBの資金調達後、急速に整備が進んでいます。業務を仕組み化・効率化したい方に向いています。"
    }
  ]'::jsonb,

  -- その他
  is_published         = true,
  accepting_casual_meetings = true,
  jobs_public          = true,
  show_fit_negatives   = true,
  logo_letter          = 'T',
  logo_gradient        = 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
  updated_at           = now()

WHERE id = '4039a638-229d-421c-b8be-c2835bf0b9c7';
