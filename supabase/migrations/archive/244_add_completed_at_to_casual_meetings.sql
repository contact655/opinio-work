-- Migration 244: ow_casual_meetings に completed_at を追加
-- 目的: 面談実績の集計を正確にするため、完了日時を独立したカラムで記録する
-- 既存レコードは 0件のため、バックフィル不要

ALTER TABLE ow_casual_meetings
  ADD COLUMN completed_at TIMESTAMPTZ;
