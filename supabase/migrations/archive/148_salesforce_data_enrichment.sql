-- Migration 148: Salesforce Japan データ充実
UPDATE ow_companies
SET
  -- フェーズ（NYSE上場）
  phase = '上場',

  -- fit_negatives を表示する
  show_fit_negatives = true,

  -- 福利厚生
  benefits = ARRAY[
    'フルフレックス制度',
    'リモートワーク可（ハイブリッド）',
    '確定拠出年金（401k相当）',
    'RSU（譲渡制限付き株式）',
    '書籍・学習費用補助',
    'ボランティア休暇（年7日）',
    '育児・介護休暇制度',
    '各種社会保険完備',
    'ウェルネス費用補助',
    'Ohana Groups（社内コミュニティ）'
  ],

  -- 評価制度
  evaluation_system = 'V2MOM（Vision/Values/Methods/Obstacles/Measures）という独自の目標管理フレームワークを使用。半年ごとのパフォーマンスレビューで、定量・定性両面から評価。マネジャーとの定期1on1が文化として根付いており、フィードバックの質が高い。グレードに応じた明確な昇格・昇給基準があり、成果を出せば年齢・社歴に関わらず評価される実力主義。',

  -- 数値情報
  avg_age = 35,
  female_ratio = '男女比 約6:4',
  avg_overtime_hours = 20,
  paid_leave_rate = 72,

  -- 会社の特徴・評判（jsonb型なのでキャスト必要）
  company_features = to_jsonb(ARRAY[
    '世界トップクラスのSaaS企業で最先端のCRM・DX領域に携われる。グローバル83,000名超の組織で、海外チームとの協働機会が豊富。英語力・グローバルスキルを実務で高められる環境。',
    'Ohana（家族）文化が浸透しており、心理的安全性が高い。「Volunteer Time Off（VTO）」として年7日のボランティア休暇が付与され、社会貢献を会社全体で推奨。多様性・インクルージョンへの取り組みが業界トップクラス。',
    '充実したL&D（Learning & Development）プログラム。Trailhead（オンライン学習プラットフォーム）を活用した継続的なスキルアップが支援される。社内異動・キャリアチェンジ制度も整備されており、長期キャリア形成に向いている。'
  ])

WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';
