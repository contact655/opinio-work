-- migration 199: 業界カテゴリを43種類 → 13カテゴリに正規化
-- 「IT / SaaS」「AI Tech」「FinTech/SaaS」など曖昧・冗長な値を整理

-- AI・データ（旧: AI Tech / データストリーミング / データベース の一部）
UPDATE ow_companies SET industry = 'AI・データ'
WHERE name IN (
  'Databricks Japan株式会社',
  'OpenAI Japan合同会社',
  'アンソロピックジャパン合同会社',
  'Snowflake Japan株式会社',
  '株式会社PKSHA Technology',
  'エラスティック株式会社',
  'グーグル合同会社',
  'クリックハウス株式会社',
  'パランティア・テクノロジーズ',
  'コンフルエント合同会社',
  'MongoDB Japan合同会社'
);

-- クラウドインフラ（旧: AI Tech / SaaS/オブザーバビリティ / インシデント管理 / ネットワーキング / API管理）
UPDATE ow_companies SET industry = 'クラウドインフラ'
WHERE name IN (
  'Datadog Japan株式会社',
  'New Relic株式会社',
  'ページャーデューティー株式会社',
  'アリスタネットワークス合同会社',
  'コング・ジャパン株式会社'
);

-- FinTech（旧: FinTech/SaaS / 経費精算 / 調達管理 / 財務・ERP / 財務会計 / 電子署名）
UPDATE ow_companies SET industry = 'FinTech'
WHERE name IN (
  'freee株式会社',
  'エヌシーノ合同会社',
  'キリバ株式会社',
  '株式会社LayerX',
  'コンカー株式会社',
  'クーパ・ソフトウェア株式会社',
  'アプティオ株式会社',
  'ブラックライン株式会社',
  'DocuSign Japan株式会社'
);

-- CRM・営業支援（旧: CRM / CRM/SaaS / Sales Tech / SaaS/カスタマーサクセス / 顧客コミュニケーション）
UPDATE ow_companies SET industry = 'CRM・営業支援'
WHERE name IN (
  '株式会社セールスフォース・ジャパン',
  'HubSpot Japan株式会社',
  'Zendesk株式会社',
  'ゲインサイト・ジャパン株式会社',
  'ブレイズ株式会社',
  'Sansan株式会社',
  'ザクトリー株式会社',
  '株式会社Translead',
  '株式会社フライル',
  '株式会社シンカ'
);

-- コラボレーション（旧: コラボレーション / コンテンツ管理 / ファイル共有 / DevTools / プロジェクト管理 / ワークフロー自動化 / デジタルアダプション）
UPDATE ow_companies SET industry = 'コラボレーション'
WHERE name IN (
  'Box Japan株式会社',
  'Dropbox Japan株式会社',
  'アトラシアン株式会社',
  'Asana Japan株式会社',
  'ServiceNow Japan合同会社',
  'ウォークミー株式会社'
);

-- マーケティング（旧: MAツール / コミュニケーションAPI / クリエイティブ / SNS/メタバース）
UPDATE ow_companies SET industry = 'マーケティング'
WHERE name IN (
  'アドビ株式会社',
  'マルケト株式会社',
  'Twilio Japan合同会社',
  'Meta日本法人'
);

-- ハードウェア・半導体（旧: ハードウェア / 半導体 / AI Tech(NVIDIA)）
UPDATE ow_companies SET industry = 'ハードウェア・半導体'
WHERE name IN (
  'アップルジャパン合同会社',
  'デル・テクノロジーズ株式会社',
  'レノボ・ジャパン合同会社',
  '日本ヒューレット・パッカード合同会社',
  '株式会社日本HP',
  'インテル株式会社',
  'クアルコムジャパン合同会社',
  'エヌビディア合同会社'
);

-- ITサービス（旧: エンタープライズIT / データベース・ERP / IT/OA機器・クラウドサービス）
UPDATE ow_companies SET industry = 'ITサービス'
WHERE name IN (
  'SAPジャパン株式会社',
  '日本IBM株式会社',
  '日本マイクロソフト株式会社',
  'ミラクル株式会社',
  '日本オラクル株式会社',
  '富士フイルムビジネスイノベーションジャパン株式会社'
);

-- Healthcare（旧: AI Tech(Ubie) / Medical AI）
UPDATE ow_companies SET industry = 'Healthcare'
WHERE name IN (
  'Ubie株式会社',
  '株式会社medimo'
);

-- HR Tech に追加（旧: その他 → エージェントはHR寄り）
UPDATE ow_companies SET industry = 'HR Tech'
WHERE name IN ('株式会社エージェント');

-- その他（旧: モビリティ / 飲料・食品 / IT/SaaS）
UPDATE ow_companies SET industry = 'その他'
WHERE name IN (
  'ウーバー・ジャパン株式会社',
  'アサヒビール株式会社',
  '株式会社TEST'
);

-- 確認クエリ（実行後に業界分布を確認）
SELECT industry, COUNT(*) as count
FROM ow_companies
GROUP BY industry
ORDER BY count DESC;
