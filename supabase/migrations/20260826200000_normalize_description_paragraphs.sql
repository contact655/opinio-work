-- 企業説明の段落を markdown の書式（空行区切り）に正規化する（2026-08-26）
--
-- 経緯:
--   企業説明の入力欄は markdown エディタだが、描画側は
--   `detail.about.split("\n")` で <p> に分ける plain text だった。
--   描画を markdown に切り替えるにあたり、既存データを markdown として
--   valid な形に直す。
--
-- ⚠️ **見た目は変わらない。** 現在の描画は改行1つを段落の区切りとして扱っており、
--    markdown で同じ結果になるのは空行区切り（\n\n）。
--    つまりこの変換は「今そう表示されているもの」を markdown で書き直しただけ。
--
-- 実測（2026-08-26 / is_test を除く87社）:
--   説明文あり 82 / 改行を含む 9 / 空行区切り 0 / markdown 記法で始まる 0
--   → 対象は「改行はあるが空行が無い」9社ちょうど。
--
-- ⚠️ 求人（ow_jobs.description）は**対象外**。5件とも改行を含まないので変換不要。

begin;

do $$
DECLARE v_target int; v_after int;
BEGIN
  SELECT count(*) INTO v_target FROM ow_companies
   WHERE description LIKE '%' || chr(10) || '%'
     AND description NOT LIKE '%' || chr(10) || chr(10) || '%';
  RAISE NOTICE '対象: % 社', v_target;
  IF v_target <> 9 THEN
    RAISE EXCEPTION '想定と違う（9社のはず。実際 %）。中止する', v_target;
  END IF;

  UPDATE ow_companies
     SET description = replace(description, chr(10), chr(10) || chr(10))
   WHERE description LIKE '%' || chr(10) || '%'
     AND description NOT LIKE '%' || chr(10) || chr(10) || '%';

  -- 変換後は全社が「空行区切り」か「改行なし」のどちらかになる
  SELECT count(*) INTO v_after FROM ow_companies
   WHERE description LIKE '%' || chr(10) || '%'
     AND description NOT LIKE '%' || chr(10) || chr(10) || '%';
  IF v_after <> 0 THEN
    RAISE EXCEPTION '変換漏れが % 社ある。中止する', v_after;
  END IF;
  RAISE NOTICE '変換完了。単一改行の残り: %', v_after;
END $$;

commit;
