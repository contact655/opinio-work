-- ow_users に username カラムを追加（スラッグベースのプロフィール URL 用）
ALTER TABLE ow_users ADD COLUMN IF NOT EXISTS username TEXT;

-- バックフィル: UUID の最初 8 文字（ハイフン除去）
-- 例: fe7dfe9b-75d4-... → "fe7dfe9b"
UPDATE ow_users
SET username = left(replace(id::text, '-', ''), 8)
WHERE username IS NULL;

-- UNIQUE インデックスを作成
CREATE UNIQUE INDEX IF NOT EXISTS ow_users_username_unique ON ow_users (username);
