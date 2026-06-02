-- Migration 127: Add join_reason to ow_experiences
-- 職歴エントリに「なぜこの会社を選んだか」テキストを追加

ALTER TABLE ow_experiences
  ADD COLUMN IF NOT EXISTS join_reason TEXT;

COMMENT ON COLUMN ow_experiences.join_reason IS '入社・転職の動機テキスト（任意、〜300文字）';
