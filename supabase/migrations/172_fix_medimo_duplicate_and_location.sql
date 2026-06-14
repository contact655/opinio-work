-- Migration 172: medimo重複削除 + location修正
-- medimo が2件登録されているため、1件（490e05a4）を削除し、残った1件のlocationを修正

-- Step 1: 重複medimo（490e05a4）の求人を削除
DELETE FROM ow_jobs WHERE company_id = '490e05a4-6e8a-46b6-9cfd-4e2f8fb8eab6';

-- Step 2: 重複medimoの企業を削除
DELETE FROM ow_companies WHERE id = '490e05a4-6e8a-46b6-9cfd-4e2f8fb8eab6';

-- Step 3: 残ったmedimoのlocationを区レベルに修正（建物名を削除）
UPDATE ow_companies
SET location = '東京都港区'
WHERE id = '2348a518-d308-4ca5-b866-7e15404ccb4a';
