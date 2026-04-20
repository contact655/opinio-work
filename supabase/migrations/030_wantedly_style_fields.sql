-- ===========================================================
-- Wantedly 型リニューアル — ow_jobs 拡張
-- Created: 2026-04-19
--
-- 目的:
--   求人一覧/詳細を「募集」型(WHY/WHAT/WHO ストーリー形式)に
--   作り直すための追加カラム。すべて nullable で既存データ無影響。
-- ===========================================================

ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS main_image_url       TEXT;
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS catch_copy           TEXT;
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS one_liner            TEXT;
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS gradient_preset      TEXT DEFAULT 'warm';
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS why_we_exit          TEXT;  -- (誤記防止用ダミー、無視してOK)
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS why_we_exist         TEXT;
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS what_youll_do_intro  TEXT;
ALTER TABLE ow_jobs ADD COLUMN IF NOT EXISTS who_we_want_intro    TEXT;

-- 上記のダミーカラム why_we_exit が間違って作られないように削除
ALTER TABLE ow_jobs DROP COLUMN IF EXISTS why_we_exit;

COMMENT ON COLUMN ow_jobs.main_image_url       IS 'カード/ヒーローのメイン画像URL。null の場合は gradient_preset を使用';
COMMENT ON COLUMN ow_jobs.catch_copy           IS '募集のキャッチコピー。30〜45文字。一覧カードと詳細ヒーローで表示';
COMMENT ON COLUMN ow_jobs.one_liner            IS '募集の一言要約。50〜80文字。一覧カードのサブテキスト';
COMMENT ON COLUMN ow_jobs.gradient_preset      IS 'メイン画像が無い場合のグラデーションプリセット: warm/cool/green/purple/dark';
COMMENT ON COLUMN ow_jobs.why_we_exist         IS 'なぜこのポジションが必要か。物語調(150〜300文字)';
COMMENT ON COLUMN ow_jobs.what_youll_do_intro  IS '仕事内容の冒頭文。1日の流れなど生活感のある描写(100〜200文字)';
COMMENT ON COLUMN ow_jobs.who_we_want_intro    IS '求める人物像の冒頭文。会社からのメッセージ(100〜200文字)';
