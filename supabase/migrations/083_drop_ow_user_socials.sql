-- ν-8 段階6-1 コミット F: ow_user_socials テーブルを物理削除
-- 前提: 事前調査で 0 行 / 0 user / 外部キーなし / コード参照なし を確認済み
-- ロールバック: supabase/migrations/080_create_ow_user_socials.sql を再実行

-- 安全確認: テーブルが空であること
DO $$
DECLARE
  row_count integer;
BEGIN
  SELECT COUNT(*) INTO row_count FROM ow_user_socials;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'ow_user_socials has % rows — aborting DROP', row_count;
  END IF;
END
$$;

DROP TABLE ow_user_socials;
