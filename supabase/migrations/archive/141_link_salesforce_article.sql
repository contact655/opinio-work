-- Migration 141: Link Salesforce article to ow_companies
-- Article: salesforce-murakami-cso-path
-- Company: 株式会社セールスフォース・ジャパン (c3664ef1-5571-4645-b30f-1474e7961c17)

UPDATE ow_articles
SET company_id = 'c3664ef1-5571-4645-b30f-1474e7961c17'
WHERE slug = 'salesforce-murakami-cso-path';
