-- Migration 160: Add can_casual_meeting flag to ow_users
-- デフォルトはfalse。人事/管理者が個別にONにした人だけカジュアル面談を受付できる。

ALTER TABLE ow_users
  ADD COLUMN IF NOT EXISTS can_casual_meeting BOOLEAN NOT NULL DEFAULT false;

-- 既存のメンター（is_mentor = true）は面談を受け付けているので true にしておく
UPDATE ow_users
SET can_casual_meeting = true
WHERE is_mentor = true;

COMMENT ON COLUMN ow_users.can_casual_meeting IS
  '人事または管理者が個別に設定。trueの人だけカジュアル面談ボタンが表示される。';
