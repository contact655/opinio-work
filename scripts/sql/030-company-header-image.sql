-- 企業ヘッダー画像・ロゴ・コンテンツカラムを追加
-- Supabase SQL Editor で実行してください
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS header_image_url text;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS cover_color text DEFAULT '#1d6fa5';
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS culture_description text;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS why_join text;
