-- 029: ow_profilesにnotify_emailカラムを追加
-- Supabase Dashboard → SQL Editor で実行してください

ALTER TABLE ow_profiles ADD COLUMN IF NOT EXISTS notify_email boolean DEFAULT true;
