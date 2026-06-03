-- Migration 152: Salesforce Japan 求人登録（公式採用ページより手動キュレーション）
-- 出典: https://careers.salesforce.com/jp/ジョブ/?country=Japan
-- 登録日: 2026-06-03

INSERT INTO ow_jobs (
  id,
  company_id,
  title,
  job_category,
  employment_type,
  location,
  work_style,
  remote_work_status,
  salary_min,
  salary_max,
  salary_note,
  catch_copy,
  one_liner,
  description,
  requirements,
  preferred,
  benefits,
  selection_steps,
  status,
  urgency,
  published_at,
  created_at,
  updated_at
) VALUES

-- ① Account Solution Engineer, Tableau
(
  gen_random_uuid(),
  'c3664ef1-5571-4645-b30f-1474e7961c17',
  'Account Solution Engineer, Tableau',
  'セールスエンジニア',
  '正社員',
  '東京都',
  'hybrid',
  'ハイブリッド勤務',
  800,
  1300,
  '経験・スキルに応じて決定。業績連動ボーナスあり',
  'データ分析の最前線で、顧客の意思決定を変える。',
  'TableauのSE（プリセールス）として、大企業の経営課題をデータビジュアライゼーションで解決するポジション。',
  'TableauのAccount Solution Engineer（SE）は、エンタープライズ顧客の営業活動をテクノロジーの側面から支えるプリセールスエンジニアです。顧客のビジネス課題を深く理解し、Tableauを用いたデータ活用のデモンストレーションやPoC（概念実証）を通じて、意思決定の質を高める提案を行います。アカウントエグゼクティブと連携し、商談の技術的側面を一手に担うやりがいのあるポジションです。',
  '・BIツールまたはデータ分析ツールの導入・活用支援経験（2年以上）
・SQLまたはデータベース操作の基礎知識
・日本語ネイティブレベル、ビジネス英語（読み書き）
・顧客向けプレゼンテーション・デモンストレーション経験',
  '・Tableau、Power BI、QlikSense等のBIツール操作スキル
・SaaS/クラウド製品のプリセールス経験
・データエンジニアリング（ETL、データウェアハウス）の知識
・英語でのコミュニケーション能力（会話）',
  'フレックスタイム制、ハイブリッド勤務、完全週休2日制、充実した健康保険、株式購入制度（ESPP）、年4回のVolunteer Time Off',
  ARRAY['書類選考', '電話スクリーニング（リクルーター）', 'ヒューマノロジー面接', '技術面接（デモプレゼン）', '最終面接', '内定'],
  'published',
  'open',
  NOW(),
  NOW(),
  NOW()
),

-- ② Lead Solution Engineer, Tableau
(
  gen_random_uuid(),
  'c3664ef1-5571-4645-b30f-1474e7961c17',
  'Lead Solution Engineer, Tableau',
  'セールスエンジニア',
  '正社員',
  '東京都',
  'hybrid',
  'ハイブリッド勤務',
  1000,
  1600,
  '経験・スキルに応じて決定。業績連動ボーナスあり',
  'Tableauの技術的エキスパートとして、大規模顧客のDXを牽引する。',
  'シニアレベルのTableau SEとして、戦略顧客の複雑なデータ課題に向き合い、後輩SEのメンタリングも担うリードポジション。',
  'Lead Solution Engineerは、Tableau SE職の上位グレードです。戦略的な大型顧客（エンタープライズ・公共）を担当し、複雑なデータアーキテクチャの設計提案から組織全体のデータドリブン文化の構築支援まで幅広く関与します。また、チーム内のSEメンバーへの技術的指導・メンタリングも期待されるリードロールです。Tableau以外にData CloudやAgentforceとの連携提案も行います。',
  '・BIツール/データ分析領域でのプリセールスまたはコンサルティング経験（5年以上）
・エンタープライズ規模の顧客への提案・導入実績
・Tableau Desktop/Server/Cloudの実務経験
・チームメンバーへの技術指導経験',
  '・Tableau Certified Professional資格
・データエンジニアリング・データウェアハウスの深い知識
・Salesforce製品（Data Cloud、CRM Analytics）との連携経験
・英語でのエグゼクティブプレゼンテーション経験',
  'フレックスタイム制、ハイブリッド勤務、完全週休2日制、充実した健康保険、株式購入制度（ESPP）、年4回のVolunteer Time Off',
  ARRAY['書類選考', '電話スクリーニング（リクルーター）', 'ヒューマノロジー面接', '技術面接（デモプレゼン）', '最終面接', '内定'],
  'published',
  'open',
  NOW(),
  NOW(),
  NOW()
),

-- ③ MuleSoft Account Executive, Enterprise Sales
(
  gen_random_uuid(),
  'c3664ef1-5571-4645-b30f-1474e7961c17',
  'Account Executive, MuleSoft（エンタープライズ営業）',
  'セールス',
  '正社員',
  '東京都',
  'hybrid',
  'ハイブリッド勤務',
  900,
  1800,
  '基本給＋インセンティブ（OTE）。高い成果には青天井の報酬あり',
  'API統合・DXの鍵を握るMuleSoftで、日本の大企業を変革する。',
  '大手企業のシステム統合・API化を推進するMuleSoftの営業職。複雑な技術課題を解決するソリューション提案が求められる戦略営業ポジション。',
  'MuleSoftのAccount Executive（AE）は、エンタープライズ企業のDX推進に不可欠なAPI統合・インテグレーションプラットフォームの営業を担います。製造業・金融・小売など多様な業界の大手企業を対象に、レガシーシステムとクラウドサービスを繋ぐMuleSoft Anypointプラットフォームの価値を提案します。技術的な複雑さを噛み砕き、経営層から現場エンジニアまで多様なステークホルダーと渡り合う交渉力が求められます。',
  '・法人向けソフトウェア/SaaSの営業経験（3年以上）
・エンタープライズ規模の顧客との商談経験
・年間売上目標の達成実績
・日本語ネイティブレベル',
  '・API/インテグレーション/ESB領域の知識
・MuleSoft、Dell Boomi、Informatica等の製品知識
・SalesforceやServiceNowとの連携提案経験
・CXO層へのエグゼクティブセリング経験',
  'フレックスタイム制、ハイブリッド勤務、完全週休2日制、充実した健康保険、株式購入制度（ESPP）、年4回のVolunteer Time Off、世界規模のセールス表彰制度（President''s Club）',
  ARRAY['書類選考', '電話スクリーニング（リクルーター）', 'ヒューマノロジー面接', '営業ロールプレイ面接', 'リーダーシップ面接', '内定'],
  'published',
  'open',
  NOW(),
  NOW(),
  NOW()
),

-- ④ Director, Customer Success Management, Financial Services
(
  gen_random_uuid(),
  'c3664ef1-5571-4645-b30f-1474e7961c17',
  'Director, Customer Success Management（金融業界）',
  'カスタマーサクセス',
  '正社員',
  '東京都',
  'hybrid',
  'ハイブリッド勤務',
  1400,
  2200,
  '経験・スキルに応じて決定。業績連動ボーナスあり',
  '金融業界のDXを、顧客成功から変える。マネージャー候補。',
  '銀行・保険・証券の大手顧客のSalesforce活用を支援するCSMチームを率いるディレクター職。チームマネジメントと戦略的顧客関係構築の両立が求められる。',
  'Director, Customer Success Management（金融サービス）は、Salesforceの金融業界向け製品（Financial Services Cloud、Marketing Cloud等）を活用する大手顧客のサクセスを管理するマネージャーポジションです。複数のCSMメンバーをマネジメントしながら、顧客のビジネス目標達成・ROI最大化・更新率向上を推進します。金融規制への理解と、CXOレベルの顧客と信頼関係を築くエグゼクティブプレゼンスが求められます。',
  '・カスタマーサクセス・コンサルティング・アカウントマネジメントのいずれかの経験（7年以上）
・チームマネジメント経験（3年以上）
・金融業界（銀行・保険・証券）への深い理解
・大手企業のCXOレベルとの折衝経験',
  '・Salesforce製品の実務経験または資格
・SaaS企業でのCSM経験
・英語ビジネスコミュニケーション
・顧客のNPS改善・チャーン率低減の実績',
  'フレックスタイム制、ハイブリッド勤務、完全週休2日制、充実した健康保険、株式購入制度（ESPP）、年4回のVolunteer Time Off',
  ARRAY['書類選考', '電話スクリーニング（リクルーター）', 'ヒューマノロジー面接', 'チームメンバーとの面接', 'リーダーシップ面接', '内定'],
  'published',
  'open',
  NOW(),
  NOW(),
  NOW()
),

-- ⑤ Business Operations - AI Methodology & Enablement
(
  gen_random_uuid(),
  'c3664ef1-5571-4645-b30f-1474e7961c17',
  'Business Operations - AI Methodology & Enablement',
  'ビジネスオペレーション',
  '正社員',
  '東京都',
  'hybrid',
  'ハイブリッド勤務',
  700,
  1100,
  '経験・スキルに応じて決定',
  'AIを現場に浸透させる。社内変革を推進するオペレーション職。',
  'AgentforceなどのAI製品を社内展開するためのメソドロジー構築・イネーブルメントを担当。営業・CSチームのAI活用を支援する新設ポジション。',
  'Business Operations - AI Methodology & Enablementは、Salesforceが自社製品として展開するAgentforceをはじめとするAIツールの社内活用を加速させるポジションです。営業・カスタマーサクセス・マーケティングなどの現場チームがAIをより効果的に活用できるよう、活用方法の標準化・トレーニング設計・ベストプラクティスの文書化を担当します。テクノロジーと現場をつなぐハブとなるクロスファンクショナルなロールです。',
  '・ビジネスオペレーション、営業企画、またはイネーブルメント領域の経験（3年以上）
・プロジェクトマネジメントスキル
・データ分析・レポーティング経験
・日本語ネイティブレベル、ビジネス英語',
  '・AI/機械学習の基礎知識
・Salesforce製品の利用経験
・トレーニング設計・コンテンツ作成の経験
・変革管理（Change Management）の知識',
  'フレックスタイム制、ハイブリッド勤務、完全週休2日制、充実した健康保険、株式購入制度（ESPP）、年4回のVolunteer Time Off',
  ARRAY['書類選考', '電話スクリーニング（リクルーター）', 'ヒューマノロジー面接', 'チーム面接', '最終面接', '内定'],
  'published',
  'open',
  NOW(),
  NOW(),
  NOW()
);
