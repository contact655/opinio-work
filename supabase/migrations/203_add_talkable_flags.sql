-- migration 203: ow_users に「話せますよ」意思表示フラグを追加
-- 本人が自分でオン/オフする。既存の can_casual_meeting（管理者付与）とは別設計。
-- 将来 can_casual_meeting は can_talk_to_hr に統合する方針。

ALTER TABLE ow_users
  ADD COLUMN IF NOT EXISTS can_talk_to_candidates BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_talk_to_hr         BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ow_users.can_talk_to_candidates IS
  '本人が設定。他の候補者から話しかけられることを許可する意思表示フラグ。';
COMMENT ON COLUMN ow_users.can_talk_to_hr IS
  '本人が設定。企業の人事担当者から話しかけられることを許可する意思表示フラグ。将来 can_casual_meeting を統合予定。';
