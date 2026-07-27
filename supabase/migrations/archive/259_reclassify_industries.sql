-- 業種タグを統一・整理
-- HR Tech（英語）→ HR・人材
UPDATE ow_companies SET industry = 'HR・人材' WHERE industry = 'HR Tech';

-- Healthcare（英語）→ ヘルスケア
UPDATE ow_companies SET industry = 'ヘルスケア' WHERE industry = 'Healthcare';

-- ITサービス の5社を個別に再分類
-- SAP → FinTech（ERP・基幹系）
UPDATE ow_companies SET industry = 'FinTech' WHERE name = 'SAPジャパン株式会社';
-- Mirakl → コマース・EC（マーケットプレイス基盤）
UPDATE ow_companies SET industry = 'コマース・EC' WHERE name = 'ミラクル株式会社';
-- IBM → クラウドインフラ
UPDATE ow_companies SET industry = 'クラウドインフラ' WHERE name = '日本IBM株式会社';
-- Microsoft → クラウドインフラ（Azure）
UPDATE ow_companies SET industry = 'クラウドインフラ' WHERE name = '日本マイクロソフト株式会社';
-- Oracle → AI・データ（データベース・クラウド）
UPDATE ow_companies SET industry = 'AI・データ' WHERE name = '日本オラクル株式会社';

-- その他（Uber）→ コマース・EC
UPDATE ow_companies SET industry = 'コマース・EC' WHERE industry = 'その他';
