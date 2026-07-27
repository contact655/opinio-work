-- Migration 128: Add strengths_finder to ow_users
-- StrengthsFinder TOP5 を TEXT 配列で保存（最大5件、CliftonStrengths 34資質）

ALTER TABLE ow_users
  ADD COLUMN IF NOT EXISTS strengths_finder TEXT[] DEFAULT '{}';

COMMENT ON COLUMN ow_users.strengths_finder IS 'StrengthsFinder TOP5（CliftonStrengths 34資質から最大5つ）';
