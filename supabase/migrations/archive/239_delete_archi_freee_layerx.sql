-- Migration 239: Archi Village / freee / LayerX の企業・求人データを全削除
-- ow_experiences の FK (ON DELETE SET NULL) が experience_company_xor 制約に違反するため、
-- 先に company_text へ変換してから削除する。

-- Step 1: ユーザー職歴の company_id を company_text に変換（職歴データは保持）
UPDATE ow_experiences
SET company_text = c.name, company_id = NULL
FROM ow_companies c
WHERE ow_experiences.company_id = c.id
  AND c.id IN (
    'f1481f96-94c8-4515-a52e-a853ede66080',  -- 株式会社Archi Village
    'f98f5d13-c72f-42fa-9c91-ee4647de2793',  -- freee株式会社
    '17e171bb-f2fa-480d-a4e1-e1382af8e842'   -- 株式会社LayerX
  );

-- Step 2: 求人削除（Archi Village 18件 / freee 3件 / LayerX 3件）
DELETE FROM ow_jobs WHERE company_id IN (
  'f1481f96-94c8-4515-a52e-a853ede66080',
  'f98f5d13-c72f-42fa-9c91-ee4647de2793',
  '17e171bb-f2fa-480d-a4e1-e1382af8e842'
);

-- Step 3: 企業削除
DELETE FROM ow_companies WHERE id IN (
  'f1481f96-94c8-4515-a52e-a853ede66080',
  'f98f5d13-c72f-42fa-9c91-ee4647de2793',
  '17e171bb-f2fa-480d-a4e1-e1382af8e842'
);
