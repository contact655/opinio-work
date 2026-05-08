-- migration 075: add future_aspirations column to ow_users
-- Phase ν-6 段階1: "この先やってみたいこと" セクション用テキストフィールド
-- 最大 500 文字を想定（クライアント側で制限、DB は TEXT NULL）

ALTER TABLE ow_users
  ADD COLUMN IF NOT EXISTS future_aspirations TEXT;

COMMENT ON COLUMN ow_users.future_aspirations IS
  'Wantedly 「この先やってみたいこと」相当。ユーザーが次に挑戦したいこと・実現したい未来を自由記述（~500文字）。';
