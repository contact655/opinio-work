-- Add prev_company, prev_role, bio columns to mentors table
ALTER TABLE mentors
  ADD COLUMN IF NOT EXISTS prev_company text,
  ADD COLUMN IF NOT EXISTS prev_role text,
  ADD COLUMN IF NOT EXISTS bio text;

-- Update mentor data with previous company info
UPDATE mentors SET
  prev_company = 'Salesforce Japan株式会社',
  prev_role = 'エンタープライズ営業',
  bio = 'Recruit4年・Salesforce Japan6年を経て独立。国家資格キャリアコンサルタント・ICFコーチ。IT/SaaS転職の支援実績120件以上。'
WHERE name LIKE '%柴%';

UPDATE mentors SET
  prev_company = 'Salesforce Japan株式会社',
  prev_role = 'エンタープライズ営業'
WHERE name LIKE '%田中%';

UPDATE mentors SET
  prev_company = 'HubSpot Japan',
  prev_role = 'カスタマーサクセス'
WHERE name LIKE '%佐藤%';
