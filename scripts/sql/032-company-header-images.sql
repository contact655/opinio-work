-- Unsplashのダミー画像を各企業に設定
-- （オフィス・テック系の写真を企業イメージに合わせて選定）
--
-- 【実行手順】Supabase SQL Editor で実行してください
-- ※ 事前に 030-company-header-image.sql を実行して header_image_url カラムを追加しておくこと

UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&q=80'
WHERE name LIKE '%Ubie%';

UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80'
WHERE name LIKE '%Sansan%';

UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=1200&q=80'
WHERE name LIKE '%Google%';

UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80'
WHERE name LIKE '%LayerX%';

UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1200&q=80'
WHERE name LIKE '%Salesforce%';

UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80'
WHERE name LIKE '%freee%' OR name LIKE '%フリー%';

UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&q=80'
WHERE name LIKE '%SmartHR%';

UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&q=80'
WHERE name LIKE '%PKSHA%';

UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=1200&q=80'
WHERE name LIKE '%Amazon%';

UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80'
WHERE name LIKE '%マイクロソフト%' OR name LIKE '%Microsoft%';

UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80'
WHERE name LIKE '%マネーフォワード%' OR name LIKE '%MoneyForward%';

UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&q=80'
WHERE name LIKE '%kubell%' OR name LIKE '%Chatwork%';

UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1200&q=80'
WHERE name LIKE '%Opinio%';

-- 残りの企業にもオフィス系のデフォルト画像を設定
UPDATE ow_companies SET
  header_image_url = 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80'
WHERE header_image_url IS NULL;
