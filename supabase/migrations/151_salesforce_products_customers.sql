-- Migration 151: Salesforce Japan 製品・導入事例リッチ化

-- customer_cases JSONB カラム追加
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS customer_cases JSONB;

-- Salesforce Japan: 製品ラインアップ更新（10製品）
UPDATE ow_companies
SET main_products = ARRAY[
  'Sales Cloud（営業支援 / SFA）',
  'Service Cloud（カスタマーサービス）',
  'Marketing Cloud（マーケティングオートメーション）',
  'Commerce Cloud（EC・コマース）',
  'Agentforce（自律型 AI エージェント）',
  'Data Cloud（統合 CDP）',
  'Tableau（データ分析・BI）',
  'Slack（コラボレーション）',
  'MuleSoft（API 統合・インテグレーション）',
  'Financial Services Cloud（金融業界向け）'
]
WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';

-- Salesforce Japan: 導入事例（公式発表ベース）
UPDATE ow_companies
SET customer_cases = '[
  {
    "name": "株式会社三越伊勢丹",
    "industry": "百貨店・小売",
    "products": ["Commerce Cloud", "Marketing Cloud", "Agentforce"],
    "usecase": "ギフト特化 EC「MOO:D MARK」を Commerce Cloud で構築。Journey Builder でメール・LINE のパーソナライズ配信を実現。",
    "result": "Einstein レコメンドがサイト売上の最大48%を占め、レコメンド経由売上が2年で3.2倍に拡大。会員数も約3倍増加。"
  },
  {
    "name": "富士通株式会社",
    "industry": "IT サービス・SI",
    "products": ["Agentforce", "Marketing Cloud", "Data Cloud"],
    "usecase": "約12万人の従業員向け社内サポートデスクに Agentforce を導入。HR・システム・経費精算などの問い合わせに AI が自律対応。",
    "result": "従来のチャットボット比で応対時間を71.5%削減。メールキャンペーン作業時間も83%削減（Marketing Cloud Next）。"
  },
  {
    "name": "日本航空株式会社（JAL）",
    "industry": "航空",
    "products": ["Marketing Cloud"],
    "usecase": "部門間で分断されていた顧客データを統合し、Journey Builder でメールマーケティングを一元化。重複配信を解消しパーソナライズを実現。",
    "result": "メール開封率・クリック率が向上。顧客体験の質が改善。"
  },
  {
    "name": "全日本空輸株式会社（ANA）",
    "industry": "航空",
    "products": ["Service Cloud", "Marketing Cloud"],
    "usecase": "コロナ禍での多拠点カスタマーサポートを統合。電話・チャット・メール・SNS を Service Cloud で一元管理し、シームレスな顧客対応を実現。",
    "result": "複数チャネルにまたがる問い合わせを1つの画面で対応可能に。エージェント生産性が向上。"
  },
  {
    "name": "カインズ株式会社",
    "industry": "ホームセンター・小売",
    "products": ["Service Cloud", "Agentforce"],
    "usecase": "店舗スタッフがタブレットから質問を入力すると、Agentforce が商品データベースと過去問い合わせ履歴をもとに即時回答を生成。スタッフが顧客に素早く正確に回答できる仕組みを構築。",
    "result": "専門的な商品知識がなくても顧客対応が可能に。スタッフの習熟期間を大幅短縮。"
  },
  {
    "name": "旭化成株式会社",
    "industry": "化学・素材",
    "products": ["Sales Cloud", "Marketing Cloud"],
    "usecase": "多角化事業部門をまたいだ全社共通 CRM「oneAK Salesforce」を構築。4万人以上の従業員が活用する営業・マーケティング DX 基盤として機能。",
    "result": "部門間の顧客情報共有が実現。グループ横断の営業活動が可視化され、戦略立案のスピードが向上。"
  },
  {
    "name": "明治安田生命保険",
    "industry": "生命保険",
    "products": ["Sales Cloud"],
    "usecase": "契約・組織情報を Sales Cloud で一元管理。2011年東日本大震災では61万人の顧客安否確認にも活用するなど、迅速な顧客対応基盤として機能。",
    "result": "コンプライアンスモニタリングの強化と顧客情報の一元管理を実現。"
  },
  {
    "name": "三井住友カード株式会社",
    "industry": "クレジットカード・金融",
    "products": ["Marketing Cloud"],
    "usecase": "2,400万超のカード会員に対し「最適チャネル×最適タイミング×最適プロモーション」の1対1マーケティングを実現。デジタルと対面コンタクトセンターを融合。",
    "result": "大規模会員基盤への個別最適化されたコミュニケーションが可能に。顧客エンゲージメントが向上。"
  }
]'::jsonb
WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';
