-- Migration 167: Add brand_name column to ow_companies
-- Display name (e.g. "Salesforce") separate from the legal company name

ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS brand_name TEXT;

-- Set known brand names
UPDATE ow_companies SET brand_name = 'Salesforce' WHERE name = '株式会社セールスフォース・ジャパン';
UPDATE ow_companies SET brand_name = 'HubSpot'    WHERE name ILIKE '%hubspot%';
UPDATE ow_companies SET brand_name = 'Datadog'    WHERE name ILIKE '%datadog%';
UPDATE ow_companies SET brand_name = 'Timee'      WHERE name ILIKE '%timee%' OR name ILIKE '%タイミー%';
