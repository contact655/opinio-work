-- 011_company_products_customers.sql
-- Adds main_products and main_customers columns to ow_companies,
-- then populates data for the 10 real companies.

-- 1. Add columns if they don't exist
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS main_products  text[],
  ADD COLUMN IF NOT EXISTS main_customers text[];

-- 2. Populate data per company

UPDATE ow_companies SET
  main_products  = ARRAY['タクシーメイト（タクシー業界専門の企業紹介）', 'M&A・事業承継サポート', 'インバウンド向け人材紹介'],
  main_customers = ARRAY['タクシー会社', 'ホテル・旅館', 'インバウンド対応事業者']
WHERE name = 'AnyTrail株式会社';

UPDATE ow_companies SET
  main_products  = ARRAY['建材サーチ（建材情報プラットフォーム）', 'アーキLink（建設業務管理システム）'],
  main_customers = ARRAY['建設会社', '建材メーカー', 'ゼネコン']
WHERE name = '株式会社Archi Village';

UPDATE ow_companies SET
  main_products  = ARRAY['落とし物クラウドfind（落とし物管理DXサービス）', 'AI落とし主マッチング', 'リユース・循環事業'],
  main_customers = ARRAY['自治体・警察署', 'ショッピングモール', '鉄道・交通事業者']
WHERE name = '株式会社find';

UPDATE ow_companies SET
  main_products  = ARRAY['Auris（ノーコードMRプラットフォーム）'],
  main_customers = ARRAY['エンタープライズ企業', '不動産・建設会社', '小売・流通業']
WHERE name = '株式会社GATARI';

UPDATE ow_companies SET
  main_products  = ARRAY['irodas SALON（学生キャリアコミュニティ）', '新卒エージェント', 'イロシル（スカウトサービス）'],
  main_customers = ARRAY['新卒採用を行う企業（400社以上）', '学生・就活生（年間15,000名以上）']
WHERE name = '株式会社irodas';

UPDATE ow_companies SET
  main_products  = ARRAY['OPINIOキャリアプラットフォーム'],
  main_customers = ARRAY['IT/SaaS業界の転職希望者', 'IT/SaaS企業の採用担当']
WHERE name = '株式会社Opinio';

UPDATE ow_companies SET
  main_products  = ARRAY['Translead CRM（営業支援SFAプラットフォーム）'],
  main_customers = ARRAY['B2Bスタートアップ', '中小企業の営業部門']
WHERE name = '株式会社Translead';

UPDATE ow_companies SET
  main_products  = ARRAY['カイクラ（顧客接点クラウドサービス）'],
  main_customers = ARRAY['自動車ディーラー', '不動産会社', '医療・クリニック', '3,100社以上（継続率99.7%）']
WHERE name = '株式会社シンカ';

UPDATE ow_companies SET
  main_products  = ARRAY['Sales Cloud（営業支援CRM）', 'Service Cloud（カスタマーサービス）', 'Marketing Cloud', 'Slack', 'Tableau'],
  main_customers = ARRAY['大手エンタープライズ企業', 'トヨタ自動車', 'ソフトバンク', '楽天グループ']
WHERE name = '株式会社セールスフォース・ジャパン';

UPDATE ow_companies SET
  main_products  = ARRAY['タイミー（スキマバイトアプリ）', 'タイミーキャリアプラス（長期就業支援）', 'BPO事業'],
  main_customers = ARRAY['コンビニ・小売チェーン', '飲食チェーン', '物流・倉庫会社', 'ホテル・旅館']
WHERE name = '株式会社タイミー';
