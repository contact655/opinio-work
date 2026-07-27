-- Migration 139: Add x_url and linkedin_url columns to ow_companies
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS x_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- Salesforce Japan
UPDATE ow_companies SET
  x_url        = 'https://x.com/SalesforceJapan',
  linkedin_url = 'https://www.linkedin.com/company/salesforce/posts/?feedView=all'
WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';
