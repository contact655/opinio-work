-- 028: ow_profilesにlast_login_atカラムを追加
-- Supabase Dashboard → SQL Editor で実行してください

ALTER TABLE ow_profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
