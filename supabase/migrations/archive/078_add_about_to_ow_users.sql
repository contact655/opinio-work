-- ν-8 段階1: 自己紹介テキスト用の about カラムを追加
-- 200字推奨（ソフトリミット、UI で誘導）。改行可。
--
-- A3 べき等化: ADD COLUMN IF NOT EXISTS に変更。
-- 注: 081 で DROP COLUMN IF EXISTS about を実行するため、
--     このカラムは 078→081 の往復で正味ゼロ（about_me に統一）。

ALTER TABLE ow_users ADD COLUMN IF NOT EXISTS about TEXT;

COMMENT ON COLUMN ow_users.about IS '自己紹介テキスト。200字推奨（ソフトリミット、UI で誘導）。改行可。081 で DROP される経由カラム。';
