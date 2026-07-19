-- Migration 262: ブランド名（省略表示名）を設定
-- ページ上で長い社名をコンパクト表示するために brand_name を更新

UPDATE ow_companies SET brand_name = 'HP'
WHERE id = '9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6'; -- 日本ヒューレット・パッカード合同会社

UPDATE ow_companies SET brand_name = '海光電業'
WHERE id = 'fde6f9c3-e2a5-457f-a6f1-e184b3a57682'; -- 海光電業株式会社

UPDATE ow_companies SET brand_name = 'CTC'
WHERE id = '138ff010-8671-414a-ab06-752d61f50dd7'; -- 伊藤忠テクノソリューションズ株式会社
