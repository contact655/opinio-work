-- Remove テスト三郎's ow_experiences record from Salesforce Japan
-- This test account (contact+08@opinio.co.jp) had is_current=true and visibility=public,
-- which would cause it to appear in the 現役社員 section after the birth_date bug fix.
DELETE FROM ow_experiences
WHERE id = '7b3835b6-f1aa-4d3a-b5d2-5b2973a0ffa8';
