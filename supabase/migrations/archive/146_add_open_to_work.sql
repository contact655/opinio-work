-- Migration 146: 転職検討中フラグ
-- ow_users に is_open_to_work カラムを追加

ALTER TABLE ow_users
  ADD COLUMN IF NOT EXISTS is_open_to_work BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ow_users.is_open_to_work IS '転職を検討中かどうかのフラグ。public プロフィールページに「転職検討中」バッジとして表示される。';
