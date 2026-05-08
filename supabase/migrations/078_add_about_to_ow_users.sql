-- ν-8 段階1: 自己紹介テキスト用の about カラムを追加
-- 200字推奨（ソフトリミット、UI で誘導）。改行可。

ALTER TABLE ow_users ADD COLUMN about TEXT;

COMMENT ON COLUMN ow_users.about IS '自己紹介テキスト。200字推奨（ソフトリミット、UI で誘導）。改行可。';
