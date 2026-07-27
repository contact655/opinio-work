-- T-1: Set Clearbit logo URLs for known companies
UPDATE ow_companies SET logo_url =
  CASE name
    WHEN 'Salesforce Japan株式会社' THEN 'https://logo.clearbit.com/salesforce.com'
    WHEN 'Google Japan合同会社' THEN 'https://logo.clearbit.com/google.com'
    WHEN '株式会社SmartHR' THEN 'https://logo.clearbit.com/smarthr.co.jp'
    WHEN 'Ubie株式会社' THEN 'https://logo.clearbit.com/ubie.life'
    WHEN 'HubSpot Japan株式会社' THEN 'https://logo.clearbit.com/hubspot.com'
    WHEN 'Amazon Japan合同会社' THEN 'https://logo.clearbit.com/amazon.co.jp'
    WHEN '株式会社マネーフォワード' THEN 'https://logo.clearbit.com/moneyforward.com'
    WHEN 'Sansan株式会社' THEN 'https://logo.clearbit.com/sansan.com'
    WHEN '株式会社LayerX' THEN 'https://logo.clearbit.com/layerx.co.jp'
    WHEN '株式会社PKSHA Technology' THEN 'https://logo.clearbit.com/pkshatech.com'
    WHEN 'フリー株式会社' THEN 'https://logo.clearbit.com/freee.co.jp'
    WHEN 'Microsoft Japan' THEN 'https://logo.clearbit.com/microsoft.com'
    ELSE logo_url
  END
WHERE logo_url IS NULL;

-- T-2: Add website_url column and populate it
ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS website_url text;

UPDATE ow_companies SET website_url =
  CASE name
    WHEN 'Salesforce Japan株式会社' THEN 'salesforce.com'
    WHEN 'Google Japan合同会社' THEN 'google.com'
    WHEN '株式会社SmartHR' THEN 'smarthr.co.jp'
    WHEN 'Ubie株式会社' THEN 'ubie.life'
    WHEN 'HubSpot Japan株式会社' THEN 'hubspot.com'
    WHEN 'Amazon Japan合同会社' THEN 'amazon.co.jp'
    WHEN '株式会社マネーフォワード' THEN 'moneyforward.com'
    WHEN 'Sansan株式会社' THEN 'sansan.com'
    WHEN '株式会社LayerX' THEN 'layerx.co.jp'
    WHEN '株式会社PKSHA Technology' THEN 'pkshatech.com'
    WHEN 'フリー株式会社' THEN 'freee.co.jp'
    WHEN 'Microsoft Japan' THEN 'microsoft.com'
    ELSE website_url
  END
WHERE website_url IS NULL;
