-- Migration 147: サンプル求人データ追加（11社 計26件）
-- 対象企業: LayerX, SmartHR, HubSpot Japan, Datadog, Notion, freee, Ubie, Sansan, PKSHA, OpenAI Japan, Databricks

-- ① LayerX（3件）
INSERT INTO ow_jobs (id, company_id, title, job_category, role_category_id, employment_type, work_style, salary_min, salary_max, location, catch_copy, requirements, status, published_at, updated_at) VALUES
(gen_random_uuid(), '17e171bb-f2fa-480d-a4e1-e1382af8e842', 'バックエンドエンジニア（Bakuraku事業部）', 'バックエンドエンジニア', 'c8140123-e29a-43b3-9dbf-1a3d21a68966', '正社員', 'full_remote', 700, 1100, '東京都（フルリモート）', '「信頼できるソフトウェアで経済活動を楽にする」LayerXのバックエンドを担うエンジニアを募集。Go/Terraformで社会インフラを設計する。', 'Go・RubyなどのバックエンドWeb開発経験3年以上', 'published', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), '17e171bb-f2fa-480d-a4e1-e1382af8e842', 'プロダクトマネージャー（AI事業部）', 'プロダクトマネージャー', '168cd1ab-d096-46cc-ad7e-5baf7f10a0b1', '正社員', 'full_remote', 800, 1300, '東京都（フルリモート）', 'AIとブロックチェーンで日本のエンタープライズを変革。LayerX AI事業部のPdMとして、最高の同僚と最難関の課題に挑む。', 'プロダクトマネージャーとしての実務経験2年以上', 'published', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(gen_random_uuid(), '17e171bb-f2fa-480d-a4e1-e1382af8e842', 'エンタープライズ営業（Bakuraku）', 'エンタープライズ営業', '6938712f-0b29-4682-ac6e-ad112734a3f1', '正社員', 'hybrid', 700, 1000, '東京都', 'バックオフィスのDXを推進するBakurakuを大手企業へ提案。「最高の同僚」と日本の経済インフラを塗り替える仕事。', 'SaaS・IT領域での法人営業経験2年以上', 'published', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days');

-- ② SmartHR（3件）
INSERT INTO ow_jobs (id, company_id, title, job_category, role_category_id, employment_type, work_style, salary_min, salary_max, location, catch_copy, requirements, status, published_at, updated_at) VALUES
(gen_random_uuid(), '81aa95dc-2304-4faa-9c4a-f2f5454e8e11', 'Rubyエンジニア（プロダクト開発）', 'バックエンドエンジニア', 'c8140123-e29a-43b3-9dbf-1a3d21a68966', '正社員', 'full_remote', 700, 1100, '東京都（フルリモート）', 'HRテックのリーダーSmartHRで、1000万人を超えるユーザーを支えるRubyコードを書く。フルリモート・フレックスで最高のチームと。', 'Ruby on RailsなどのWebアプリ開発経験3年以上', 'published', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), '81aa95dc-2304-4faa-9c4a-f2f5454e8e11', 'カスタマーサクセス（エンタープライズ）', 'カスタマーサクセス', 'ad47e554-e328-4aec-abd1-dab9953ddf9d', '正社員', 'hybrid', 550, 850, '東京都', '大手企業のSmartHR活用を最大化するCSMとして、人事のDXを伴走支援する。', '法人向けカスタマーサクセスまたはコンサルタント経験2年以上', 'published', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
(gen_random_uuid(), '81aa95dc-2304-4faa-9c4a-f2f5454e8e11', 'プロダクトデザイナー', 'プロダクトデザイナー', '9f8deb80-3c93-450b-ad30-dfab90430ea4', '正社員', 'full_remote', 650, 1000, '東京都（フルリモート）', '1000万人が使うHRプロダクトのUXを設計する。Figmaで始まり実装まで一貫して関われる環境で、本質的なデザインに集中できる。', 'UIUXデザインの実務経験2年以上、Figma使用経験', 'published', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days');

-- ③ HubSpot Japan（3件）
INSERT INTO ow_jobs (id, company_id, title, job_category, role_category_id, employment_type, work_style, salary_min, salary_max, location, catch_copy, requirements, status, published_at, updated_at) VALUES
(gen_random_uuid(), 'aaaaaaaa-0001-0001-0001-000000000007', 'Account Executive（Mid-Market）', 'エンタープライズ営業', '6938712f-0b29-4682-ac6e-ad112734a3f1', '正社員', 'hybrid', 700, 1100, '東京都', 'マーケティング・営業・CSを一つのプラットフォームで統合するHubSpotを、成長中のSaaS企業へ提案。高いOTE設計とキャリアパスが魅力。', 'SaaS・IT領域での法人営業経験2年以上', 'published', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'aaaaaaaa-0001-0001-0001-000000000007', 'Solutions Engineer（プリセールス）', 'ソリューションエンジニア', 'c8140123-e29a-43b3-9dbf-1a3d21a68966', '正社員', 'hybrid', 850, 1300, '東京都', '営業xエンジニアのハイブリッドロール。顧客のビジネス課題をHubSpot技術で解決し、最高品質のデモを届けるSEを募集。', 'Webアプリ開発またはSaaS技術営業の経験2年以上', 'published', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
(gen_random_uuid(), 'aaaaaaaa-0001-0001-0001-000000000007', 'Customer Success Manager', 'カスタマーサクセス', 'ad47e554-e328-4aec-abd1-dab9953ddf9d', '正社員', 'hybrid', 650, 950, '東京都', '導入後のオンボーディングからエクスパンションまで、HubSpotで顧客の成長を支援するCSM。世界最高水準のSaaS企業で学べる環境。', 'SaaSプロダクトのCSまたはコンサルタント経験2年以上', 'published', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');

-- ④ Datadog Japan（2件）
INSERT INTO ow_jobs (id, company_id, title, job_category, role_category_id, employment_type, work_style, salary_min, salary_max, location, catch_copy, requirements, status, published_at, updated_at) VALUES
(gen_random_uuid(), 'a5ffac90-70aa-4242-b867-6d9334317851', 'Sales Engineer（Infrastructure/Cloud）', 'セールスエンジニア', 'c8140123-e29a-43b3-9dbf-1a3d21a68966', '正社員', 'hybrid', 1000, 1600, '東京都', 'クラウドインフラ監視のグローバルリーダー。SE/プリセールスとして大手エンタープライズに技術提案を行い、年収1000万円超を目指す。', 'Linux/クラウド（AWS/GCP/Azure）の技術知識、法人技術営業または運用経験', 'published', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(gen_random_uuid(), 'a5ffac90-70aa-4242-b867-6d9334317851', 'Enterprise Account Executive', 'エンタープライズ営業', '6938712f-0b29-4682-ac6e-ad112734a3f1', '正社員', 'hybrid', 900, 1400, '東京都', '大手金融・製造・通信業界へDatadogを拡販するエンタープライズAE。戦略的提案力と粘り強いリレーション構築で高収入を実現。', 'エンタープライズSaaS営業経験3年以上', 'published', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days');

-- ⑤ Notion Japan（2件）
INSERT INTO ow_jobs (id, company_id, title, job_category, role_category_id, employment_type, work_style, salary_min, salary_max, location, catch_copy, requirements, status, published_at, updated_at) VALUES
(gen_random_uuid(), 'bf24736f-fa65-4c5a-9764-98c96ace3b07', 'Account Executive, SMB Japan', 'SMB営業', '6938712f-0b29-4682-ac6e-ad112734a3f1', '正社員', 'hybrid', 700, 1100, '東京都', '世界5000万人が使うNotionをSMB企業へ拡販。シリコンバレーのカルチャーを持つ急成長SaaSで、日本マーケットの拡大をリードする。', 'SaaS法人営業経験2年以上', 'published', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
(gen_random_uuid(), 'bf24736f-fa65-4c5a-9764-98c96ace3b07', 'Solutions Engineer Japan', 'ソリューションエンジニア', 'c8140123-e29a-43b3-9dbf-1a3d21a68966', '正社員', 'hybrid', 800, 1200, '東京都', '導入前から導入後まで、Notion活用を技術観点で支援するSE。プロダクト知識と顧客理解で最高のNotionを届ける役割。', 'SaaS技術営業またはWebアプリ開発経験2年以上', 'published', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days');

-- ⑥ freee（3件）
INSERT INTO ow_jobs (id, company_id, title, job_category, role_category_id, employment_type, work_style, salary_min, salary_max, location, catch_copy, requirements, status, published_at, updated_at) VALUES
(gen_random_uuid(), 'f98f5d13-c72f-42fa-9c91-ee4647de2793', 'バックエンドエンジニア（会計プラットフォーム）', 'バックエンドエンジニア', 'c8140123-e29a-43b3-9dbf-1a3d21a68966', '正社員', 'full_remote', 650, 1050, '東京都（フルリモート）', '100万社の会計・人事インフラを担うfreeeのバックエンドを設計・実装。Rubyで書かれた経済の基盤に向き合う仕事。', 'Ruby/Railsまたは同等のバックエンド開発経験2年以上', 'published', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'f98f5d13-c72f-42fa-9c91-ee4647de2793', 'プロダクトマネージャー（freee人事労務）', 'プロダクトマネージャー', '168cd1ab-d096-46cc-ad7e-5baf7f10a0b1', '正社員', 'hybrid', 750, 1100, '東京都', '日本の労務・人事DXを推進するfreee人事労務のPdM。100万社の業務課題を解決するプロダクト戦略を描く。', 'プロダクトマネジメント経験2年以上', 'published', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
(gen_random_uuid(), 'f98f5d13-c72f-42fa-9c91-ee4647de2793', 'カスタマーサクセス（中小企業向け）', 'カスタマーサクセス', 'ad47e554-e328-4aec-abd1-dab9953ddf9d', '正社員', 'hybrid', 450, 750, '東京都', '「スモールビジネスを世界の主役に」freeeを使う中小企業の伴走者として、会計・人事の悩みを解決する最前線のCS。', '法人向けSaaSのカスタマーサポートまたはCS経験1年以上', 'published', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days');

-- ⑦ Ubie（2件）
INSERT INTO ow_jobs (id, company_id, title, job_category, role_category_id, employment_type, work_style, salary_min, salary_max, location, catch_copy, requirements, status, published_at, updated_at) VALUES
(gen_random_uuid(), 'fb7397eb-a9c7-4ce3-964a-d7a72159847f', 'ソフトウェアエンジニア（医療AIプロダクト）', 'ソフトウェアエンジニア', 'c8140123-e29a-43b3-9dbf-1a3d21a68966', '正社員', 'full_remote', 750, 1200, '東京都（フルリモート）', '医療をアルゴリズムで解くUbie。AIを使って「必要な人に必要な医療を届ける」プロダクトのエンジニアリングを担う。', 'Webアプリ開発経験3年以上（言語不問）', 'published', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'fb7397eb-a9c7-4ce3-964a-d7a72159847f', 'プロダクトマネージャー（病院向けDX）', 'プロダクトマネージャー', '168cd1ab-d096-46cc-ad7e-5baf7f10a0b1', '正社員', 'hybrid', 800, 1200, '東京都', '全国3000超の病院に導入されるUbieのPM。医療現場の課題を技術で解決するやりがいある仕事。', 'PdMまたはUXリサーチ経験2年以上', 'published', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days');

-- ⑧ Sansan（2件）
INSERT INTO ow_jobs (id, company_id, title, job_category, role_category_id, employment_type, work_style, salary_min, salary_max, location, catch_copy, requirements, status, published_at, updated_at) VALUES
(gen_random_uuid(), '8b9f84b0-b4be-4191-8322-07c6a2e5e91a', 'Railsエンジニア（名刺データ基盤）', 'バックエンドエンジニア', 'c8140123-e29a-43b3-9dbf-1a3d21a68966', '正社員', 'hybrid', 650, 1050, '東京都', 'SansanとSalesforceの連携を支える名刺データ基盤を開発。「名刺から経営インフラへ」の転換を技術で支えるRubyエンジニア。', 'Ruby on Railsを用いたWebアプリ開発経験2年以上', 'published', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
(gen_random_uuid(), '8b9f84b0-b4be-4191-8322-07c6a2e5e91a', 'カスタマーサクセス（エンタープライズ）', 'カスタマーサクセス', 'ad47e554-e328-4aec-abd1-dab9953ddf9d', '正社員', 'hybrid', 600, 900, '東京都', 'B2B SaaSのパイオニアSansanで、大手企業の営業DX推進を伴走支援。名刺データ活用から始まる経営インフラ改革に携わる。', '法人向けSaaSのカスタマーサクセスまたはコンサルタント経験2年以上', 'published', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days');

-- ⑨ PKSHA Technology（2件）
INSERT INTO ow_jobs (id, company_id, title, job_category, role_category_id, employment_type, work_style, salary_min, salary_max, location, catch_copy, requirements, status, published_at, updated_at) VALUES
(gen_random_uuid(), '09d67e54-0381-45c8-b698-568e1fc47033', 'MLエンジニア（自然言語処理）', 'MLエンジニア', 'c8140123-e29a-43b3-9dbf-1a3d21a68966', '正社員', 'hybrid', 750, 1300, '東京都', '「AIは道具ではなく、共同作業者だ」PKSHAで大規模NLPモデルの開発・商用化を担うMLエンジニアを募集。東大発AIスタートアップの核心。', '機械学習・自然言語処理の研究または開発経験（修士以上歓迎）', 'published', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(gen_random_uuid(), '09d67e54-0381-45c8-b698-568e1fc47033', 'AIリサーチエンジニア', 'リサーチエンジニア', 'c8140123-e29a-43b3-9dbf-1a3d21a68966', '正社員', 'hybrid', 900, 1600, '東京都', 'PKSHAの研究部門で最先端LLM・マルチモーダルAIの研究開発。トップカンファレンスレベルの研究成果を事業に転換する希少なポジション。', '機械学習分野での論文執筆経験または同等の研究・開発実績', 'published', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days');

-- ⑩ OpenAI Japan（2件）
INSERT INTO ow_jobs (id, company_id, title, job_category, role_category_id, employment_type, work_style, salary_min, salary_max, location, catch_copy, requirements, status, published_at, updated_at) VALUES
(gen_random_uuid(), 'daa558e5-054f-4475-ab00-3817170759ce', 'Enterprise Account Executive, Japan', 'エンタープライズ営業', '6938712f-0b29-4682-ac6e-ad112734a3f1', '正社員', 'hybrid', 1500, 2500, '東京都', 'GPT・ChatGPT Enterpriseを日本の大手企業へ展開するAE。世界最高のAI企業で、日本のAI活用を加速させるトップ営業職。', 'エンタープライズSaaS営業経験4年以上、英語ビジネスレベル', 'published', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'daa558e5-054f-4475-ab00-3817170759ce', 'Solutions Architect, Japan', 'ソリューションズアーキテクト', 'c8140123-e29a-43b3-9dbf-1a3d21a68966', '正社員', 'hybrid', 1500, 2500, '東京都', 'ChatGPT/GPT-4のAPIを活用した企業向けソリューションの設計を担当。OpenAIのテクノロジーで日本のDXを最前線で推進する。', 'ソリューションアーキテクトまたはテクニカルセールス経験3年以上、Python/API開発経験', 'published', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');

-- ⑪ Databricks Japan（2件）
INSERT INTO ow_jobs (id, company_id, title, job_category, role_category_id, employment_type, work_style, salary_min, salary_max, location, catch_copy, requirements, status, published_at, updated_at) VALUES
(gen_random_uuid(), 'ae15610d-477a-410d-b74a-54ab3e351add', 'Solutions Architect（Data/AI）', 'ソリューションズアーキテクト', 'c8140123-e29a-43b3-9dbf-1a3d21a68966', '正社員', 'hybrid', 1100, 1800, '東京都', 'データレイクハウスのリーダーDatabricksで、大手企業のData/AI基盤構築を技術支援。SparkやMLflowを武器に、データ活用の最前線へ。', 'Python/SparkなどのビッグデータまたはMLOpsの実務経験3年以上', 'published', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
(gen_random_uuid(), 'ae15610d-477a-410d-b74a-54ab3e351add', 'Enterprise Account Executive（金融・製造業界）', 'エンタープライズ営業', '6938712f-0b29-4682-ac6e-ad112734a3f1', '正社員', 'hybrid', 1000, 1600, '東京都', 'ユニコーン企業Databricksで金融・製造の大手顧客にデータ基盤を提案。高いコミッション設計と世界水準のチームで急成長できる環境。', 'データ/クラウドSaaSのエンタープライズ営業経験3年以上', 'published', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days');
