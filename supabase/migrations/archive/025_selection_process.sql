-- Fix 19 (revised): Selection process transparency
-- Replaces the previous "Opinio経由の選考実績" concept with company-published info.

ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS selection_process jsonb;

ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS hiring_policy jsonb;

-- selection_process structure example:
-- {
--   "steps": [
--     {"name": "書類選考", "duration": "約1週間"},
--     {"name": "1次面接", "duration": "1〜2週間", "note": "オンライン、現場リーダー"},
--     {"name": "カルチャーフィット面談", "duration": "1週間"},
--     {"name": "最終面接", "duration": "1週間", "note": "役員"}
--   ],
--   "total_duration": "平均3〜4週間",
--   "interview_count": 3,
--   "online_available": true
-- }

-- hiring_policy structure example:
-- [
--   "経験・スキルより人物重視",
--   "カジュアル面談から始めることも可能",
--   "フィードバック必ず返します",
--   "内定後の入社時期は相談可"
-- ]
