-- Migration 162: ow_users に catchphrase カラムを追加
-- 社員・採用担当者カードでひとこと表示に使用
ALTER TABLE ow_users ADD COLUMN IF NOT EXISTS catchphrase TEXT;
