-- Migration 171: Add branch_locations column to ow_companies
-- 東京以外の日本国内支社・営業拠点（都道府県名のみ）

ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS branch_locations TEXT[] DEFAULT NULL;

-- ── 支社データ投入 ──────────────────────────────────────────────────────────────

-- Sansan株式会社 (大阪・名古屋・福岡・京都)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡', '京都']
WHERE id = '8b9f84b0-b4be-4191-8322-07c6a2e5e91a';

-- SmartHR株式会社 (大阪・名古屋・福岡・広島)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡', '広島']
WHERE id = '81aa95dc-2304-4faa-9c4a-f2f5454e8e11';

-- freee株式会社 (大阪・福岡)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '福岡']
WHERE id = 'f98f5d13-c72f-42fa-9c91-ee4647de2793';

-- Indeed Japan株式会社 (大阪・名古屋・福岡)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡']
WHERE id = 'e7e9b0be-20c2-4434-afea-7a27c89332e2';

-- 株式会社セールスフォース・ジャパン (大阪・名古屋・福岡)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡']
WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';

-- SAPジャパン株式会社 (大阪・名古屋・福岡)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡']
WHERE id = 'bcea5e4e-94ee-4019-8ce3-237a7edf79a7';

-- 日本マイクロソフト株式会社 (大阪・名古屋・福岡)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡']
WHERE id = '40dca29e-aa4b-4654-aada-8e29763f8521';

-- 日本オラクル株式会社 (大阪・名古屋・福岡)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡']
WHERE id = '1f8010f2-ba3f-4f7a-b7f4-d5b60400e638';

-- シスコシステムズ合同会社 (大阪・名古屋・福岡)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡']
WHERE id = '27988ac1-fd93-445d-a9fd-6dad74c92686';

-- デル・テクノロジーズ株式会社 (大阪・名古屋・福岡)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡']
WHERE id = 'f4acddc0-c746-4537-9edf-6f3c1f2c90b3';

-- 日本ヒューレット・パッカード合同会社 (大阪・名古屋・福岡)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡']
WHERE id = '9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6';

-- 株式会社日本HP (大阪・名古屋・福岡)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡']
WHERE id = 'c32027b9-cfbd-4a70-bf4c-464e42790db4';

-- コンカー株式会社 (大阪・名古屋・福岡)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡']
WHERE id = '91523b3b-15e4-4f6b-8c9b-a90b67552b9e';

-- 日本IBM株式会社 (大阪・名古屋・福岡・神奈川・埼玉)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡', '神奈川', '埼玉']
WHERE id = '9ef65fa1-e04b-4098-a7b1-4ee3d535a23a';

-- 株式会社タイミー (大阪・名古屋・福岡)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '名古屋', '福岡']
WHERE id = '2e54ff06-2f4d-420c-9a5c-9a80a85ca55a';

-- Ubie株式会社 (大阪・福岡)
UPDATE ow_companies SET branch_locations = ARRAY['大阪', '福岡']
WHERE id = 'fb7397eb-a9c7-4ce3-964a-d7a72159847f';

-- グーグル合同会社 (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = '7d186c45-ce23-4d96-8eae-cd6e7c00faee';

-- アマゾン ウェブ サービス ジャパン合同会社 (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = 'a9de1561-eb91-4ebf-842d-f6d39865b7ef';

-- アドビ株式会社 (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = 'eccd3dfb-decd-4277-a3a4-df489d3b3e5e';

-- インテル株式会社 (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = 'ec97fde1-6f22-4ab5-89ee-9cea0b258f2a';

-- レノボ・ジャパン合同会社 (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = 'f201ed17-a9e2-4859-85aa-474578b2870d';

-- HubSpot Japan株式会社 (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = 'aaaaaaaa-0001-0001-0001-000000000007';

-- ServiceNow Japan合同会社 (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = '4df6e844-74d6-4f50-98f9-08468a12f1dc';

-- フォーティネット株式会社 (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = '3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2';

-- New Relic株式会社 (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = '0d4734e0-0717-475e-a6d1-806aa2cd45ff';

-- Datadog Japan株式会社 (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = 'a5ffac90-70aa-4242-b867-6d9334317851';

-- パロアルトネットワークス株式会社 (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = 'f4a6aa23-3775-4548-981b-156e416ef6f6';

-- クアルコムジャパン合同会社 (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = '94edfbe5-0496-4c1d-865c-d2d448232135';

-- 株式会社ワークデイ (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = '8dc04d46-3430-45de-91f8-e37c8880b8a5';

-- 株式会社LayerX (大阪)
UPDATE ow_companies SET branch_locations = ARRAY['大阪']
WHERE id = '17e171bb-f2fa-480d-a4e1-e1382af8e842';
