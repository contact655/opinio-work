-- phase 正規化: 日本語値 → 英語スラッグ（11社）

UPDATE ow_companies SET phase = 'series_b'  WHERE phase = 'シリーズB';
UPDATE ow_companies SET phase = 'unicorn'   WHERE phase = 'ユニコーン';
UPDATE ow_companies SET phase = 'listed'    WHERE phase = '上場';
UPDATE ow_companies SET phase = 'non_listed' WHERE phase = '非上場';
UPDATE ow_companies SET phase = 'non_listed'
  WHERE phase = '非上場（2023年12月 東証プライム上場廃止、伊藤忠商事グループ）';

-- 伊藤忠テクノソリューションズ（id: 138ff010-...）の資本関係追加設定
UPDATE ow_companies
SET
  capital_notes          = '2023年12月に東証プライム上場廃止。伊藤忠商事グループ。',
  capital_type           = 'japanese_group',
  parent_company_name    = '伊藤忠商事株式会社',
  parent_company_country = '日本'
WHERE id = '138ff010-8671-414a-ab06-752d61f50dd7';

-- 全行検証: 非正規値が残っていれば失敗し、このトランザクションごとロールバックされる
ALTER TABLE ow_companies
  VALIDATE CONSTRAINT ow_companies_phase_check;
