-- Migration 170: 面談受付中フラグを無効化（LayerX / PKSHA / Ubie / freee / SmartHR / Sansan）
-- これらの企業は現時点でカジュアル面談を受け付けていないため UI 上のバッジを非表示にする

UPDATE ow_companies
SET accepting_casual_meetings = false
WHERE id IN (
  'f98f5d13-c72f-42fa-9c91-ee4647de2793', -- freee株式会社
  '8b9f84b0-b4be-4191-8322-07c6a2e5e91a', -- Sansan株式会社
  '81aa95dc-2304-4faa-9c4a-f2f5454e8e11', -- SmartHR株式会社
  'fb7397eb-a9c7-4ce3-964a-d7a72159847f', -- Ubie株式会社
  '17e171bb-f2fa-480d-a4e1-e1382af8e842', -- 株式会社LayerX
  '09d67e54-0381-45c8-b698-568e1fc47033'  -- 株式会社PKSHA Technology
);
