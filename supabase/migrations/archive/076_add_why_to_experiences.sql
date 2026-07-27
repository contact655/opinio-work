-- Migration 076: ow_experiences に why カラムを追加
-- Phase ν-6 段階 4 — 職歴の "なぜその仕事をしていたか" 自由記述フィールド
--
-- 上限 500 文字（future_aspirations と揃える）

ALTER TABLE ow_experiences
  ADD COLUMN IF NOT EXISTS why TEXT
    CHECK (char_length(why) <= 500);

COMMENT ON COLUMN ow_experiences.why IS
  'この時期に目指していたこと・想いを自由記述（上限500文字）。Phase ν-6 段階4で追加。';
