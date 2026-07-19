-- Migration 258: 企業承認フラグ (is_approved) を追加
-- 目的: 新規企業は運営が承認するまで公開ページに表示しない

-- 1. is_approved カラム追加
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ow_companies.is_approved IS '運営が承認した企業のみ true。is_published=true にするには is_approved=true が前提。';

-- 2. 現在 is_published=true の企業は承認済みとみなす
UPDATE ow_companies SET is_approved = true WHERE is_published = true;

-- 3. KAIKOU DENGYO・ITOCHU Techno-Solutions を非公開かつ未承認に戻す
UPDATE ow_companies
SET is_published = false, is_approved = false
WHERE id IN (
  '138ff010-8671-414a-ab06-752d61f50dd7',  -- 伊藤忠テクノソリューションズ株式会社
  'fde6f9c3-e2a5-457f-a6f1-e184b3a57682'   -- 海光電業株式会社
);
