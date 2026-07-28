-- 株式会社セールスフォース・ジャパン（id: c3664ef1-5571-4645-b30f-1474e7961c17）
-- ⑦ 資本関係・グループ フィールド投入 + description 修正
--
-- 従業員数の根拠:
--   Salesforce, Inc. Form 10-K（FY2024、会計年度終了: 2024年1月31日）記載値 72,682名
--   旧 description の「83,000名以上」はFY2023 Q3時点（2023年1月大規模レイオフ前）の値

UPDATE ow_companies
SET
  capital_type           = 'foreign_subsidiary',
  parent_company_name    = 'Salesforce, Inc.',
  parent_company_country = '米国',
  global_employee_count  = '約73,000名（2024年1月期末）',
  listed_exchange        = NULL,
  capital_notes          = '親会社 Salesforce, Inc. は米国NYSE上場（ティッカー: CRM）。日本法人は非上場。',
  description            = '世界No.1のCRMプラットフォーム「Salesforce」を日本で展開。営業・マーケティング・カスタマーサービス領域のクラウドサービスをエンタープライズから中小企業まで幅広く提供。グローバル約73,000名（2024年1月期末）が在籍する米国NYSE上場企業の日本法人。'
WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';
