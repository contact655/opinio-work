-- migration: 111_ow_mentors_user_id_not_null.sql
-- ow_mentors.user_id を NOT NULL 化する
-- 事前確認: SELECT COUNT(*) FROM ow_mentors WHERE user_id IS NULL → 0件 (確認済み 2026-05-21)
-- ow_users と ow_mentors を必ず 1:1 でリンクするための制約強化

ALTER TABLE ow_mentors
  ALTER COLUMN user_id SET NOT NULL;
