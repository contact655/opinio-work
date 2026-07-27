-- migration 033: Add 'scheduling' to ow_casual_meetings status enum
-- Phase 3 S2 で UI に scheduling ステータスを追加済み。DB制約を対応させる。

ALTER TABLE ow_casual_meetings
  DROP CONSTRAINT IF EXISTS ow_casual_meetings_status_check;

ALTER TABLE ow_casual_meetings
  ADD CONSTRAINT ow_casual_meetings_status_check
  CHECK (status IN (
    'pending', 'company_contacted', 'scheduling',
    'scheduled', 'completed', 'declined'
  ));

COMMENT ON COLUMN ow_casual_meetings.status IS
  'pending=新規受信, company_contacted=確認中, scheduling=日程調整中,
   scheduled=面談予定, completed=完了, declined=見送り';
