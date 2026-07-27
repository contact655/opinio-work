-- migration 075: add future_aspirations column to ow_users
-- Phase ν-6 段階1: "この先やってみたいこと" セクション用テキストフィールド
-- 500 文字上限を CHECK 制約で保証

ALTER TABLE ow_users
  ADD COLUMN IF NOT EXISTS future_aspirations TEXT
    CHECK (char_length(future_aspirations) <= 500);

COMMENT ON COLUMN ow_users.future_aspirations IS
  'Wantedly 「この先やってみたいこと」相当。次に挑戦したいこと・実現したい未来を自由記述（上限500文字）。';
