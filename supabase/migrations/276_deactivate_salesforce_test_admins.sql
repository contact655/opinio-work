-- Deactivate test accounts (テスト三郎・14テスト) from ow_company_admins
-- These appeared in Salesforce Japan's 採用担当者 section because the filter
-- only excluded @seed.internal emails, not contact+NN@opinio.co.jp test accounts.
UPDATE ow_company_admins
SET is_active = false
WHERE user_id IN (
  SELECT id FROM ow_users WHERE email IN ('contact+08@opinio.co.jp', 'contact+14@opinio.co.jp')
);
