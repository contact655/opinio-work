-- Migration 259: SmartHR社名修正 + SmartHR/PKSHA/Ubie 求人削除（企業データ保持）

-- SmartHR社名修正
UPDATE ow_companies
SET name = '株式会社SmartHR', updated_at = NOW()
WHERE id = '81aa95dc-2304-4faa-9c4a-f2f5454e8e11';

-- SmartHR・PKSHA Technology・Ubie の求人を削除（企業データはそのまま）
DELETE FROM ow_jobs
WHERE company_id IN (
  '81aa95dc-2304-4faa-9c4a-f2f5454e8e11', -- 株式会社SmartHR
  '09d67e54-0381-45c8-b698-568e1fc47033', -- 株式会社PKSHA Technology
  'fb7397eb-a9c7-4ce3-964a-d7a72159847f'  -- Ubie株式会社
);
