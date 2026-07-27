-- フェーズ2-1: Salesforce Japan プロフィールブロック初期データ投入
-- 対象: 1社のみ (id = c3664ef1-5571-4645-b30f-1474e7961c17)
-- 出典: 公開情報（salesforce.com/products, 公開導入事例）

UPDATE ow_companies
SET
  biz_model_types       = ARRAY['subscription'],
  biz_model_note        = 'ユーザー数と製品の組み合わせに応じた年間サブスクリプション（USD 建て）。',
  market_customer_size  = ARRAY['enterprise', 'mid_market'],
  market_decision_maker = '営業・IT 部門長〜CxO レベル。エンタープライズ案件では取締役・役員クラスとの商談が必要になる。',
  market_note           = '大手・上場企業を担当するエンタープライズ部門と、従業員 200〜2000 名規模を担当するコマーシャル部門が独立して存在する。公開されている導入事例は製造・金融・航空・小売・公共など業種横断。'
WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';
