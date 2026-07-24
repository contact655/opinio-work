-- Migration 258: 公開中の全企業でカジュアル面談・求人公開を有効化
UPDATE ow_companies
SET
  accepting_casual_meetings = true,
  jobs_public = true
WHERE is_published = true;
