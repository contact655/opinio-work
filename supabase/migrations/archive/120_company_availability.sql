-- Migration 120: 企業の面談受付スケジュール設定
-- 企業担当者が希望の面談受付曜日・時間帯を設定できるようにする

ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS availability_days  text[] DEFAULT '{}',
  -- 例: '{"月", "火", "水", "木", "金"}'
  ADD COLUMN IF NOT EXISTS availability_times text[] DEFAULT '{}',
  -- 例: '{"朝（9-12時）", "昼（12-15時）", "夜（18-21時）"}'
  ADD COLUMN IF NOT EXISTS availability_notes text;
  -- 例: "週2〜3回程度、30分カジュアルに話せます"

COMMENT ON COLUMN ow_companies.availability_days  IS '面談受付曜日の配列（例: {"月","水","金"}）';
COMMENT ON COLUMN ow_companies.availability_times IS '面談受付時間帯の配列';
COMMENT ON COLUMN ow_companies.availability_notes IS '面談に関する補足コメント（自由記述）';
