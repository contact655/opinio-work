-- ═══════════════════════════════════════════════════════════════════════════
-- フライルの logo_url を設定する（2026-08-29 / 第3バッチ・1社）
--
-- ── 何をしたか ──────────────────────────────────────────────────────────────
-- `logo_url` が **NULL**（letter フォールバック "F"）だったフライルに、
-- 公式サイトのアイコンを入れる。
--
-- | | 前 | 後 |
-- |---|---|---|
-- | logo_url | **NULL**（letter "F" / 紫グラデ） | `.../logo.png` |
-- | 実寸 | — | **36x36・透過あり** |
-- | 出所 | — | `https://flyle.io/` の `<link rel=icon>` |
--
-- ⚠️ 他6社（`20260828170000` / `20260828180000`）は「既存URLの上書き」か
--    「拡張子の変更」だったが、**これは新規設定**。したがって
--    **旧ファイルの孤児は生まれない**（元から Storage に何も無かった）。
--
-- 実ファイルは `scripts/upload-logos-20260828d.mjs` で
-- `companies/logos/{id}/logo.png` の**固定名 + upsert**で上げてある（`1cddb4ca` の形）。
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ★★PKSHA Technology は入れない。`logo_url` を NULL のまま維持する
-- ═══════════════════════════════════════════════════════════════════════════
-- 保留していた2社のうち、**フライルだけ**を採り、PKSHA は見送った（柴さんの判断）。
--
-- 理由:
--   ① 候補は **32x32**。68px 枠（画像領域 54px）で **1.7倍に拡大**すると、
--      **黒い三角が「再生ボタン」に誤読される。**
--   ② letter（**紫グラデに白い "P"**）のほうが**識別性が高い。**
--   ③ ★**letter は破綻ではなく「ロゴが無い」ことの表現。** そのまま残す。
--      ⚠️ 「NULL を埋める」こと自体を目的にしないこと。埋めると**誤読される絵**に
--         置き換わる。CLAUDE.md「値が無いことを、ある値に置き換えない」と同じ筋。
--
-- ⚠️ **より大きい素材が手に入るまで、PKSHA をこの migration の形で足さないこと。**
--    ブランド/プレス系10パスも当たったが 0 件だった（2026-08-28 実測）。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260829-0009-ow_companies.sql（スキーマ+データ / 88行）
--   ⚠️ 戻すときは `logo_url` を NULL に戻すだけでよい（letter に自動で落ちる）。
--   ⚠️ 数を書くときは母集合も書くこと。**掲載中79社では NULL 2社／全88行では 11社**。
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_flyle_null int; v_pksha_null int; v_total int; v_null_listed int; v_null_all int;
BEGIN
  -- ★フライルがまだ NULL であること（二重適用を成功に見せない）
  SELECT count(*) INTO v_flyle_null FROM public.ow_companies
   WHERE id = 'cb386dd2-427c-49d1-b3f8-1e1d3a921fd8' AND logo_url IS NULL;
  IF v_flyle_null <> 1 THEN
    RAISE EXCEPTION 'フライルの logo_url が NULL ではない（適用済みか、前提が違う）。中止';
  END IF;

  -- ★PKSHA も NULL であること（触っていないことの前提）
  SELECT count(*) INTO v_pksha_null FROM public.ow_companies
   WHERE name = '株式会社PKSHA Technology' AND logo_url IS NULL;
  IF v_pksha_null <> 1 THEN RAISE EXCEPTION 'PKSHA の logo_url が NULL ではない。中止'; END IF;

  /* ⚠️★**「NULL は2社」は掲載中79社での数。** `ow_companies` 全88行では 11社ある
        （非公開・非掲載・is_test を含むため）。**数を書くときは母集合も書く。**
        2026-08-29 に、ここを全件で数えて migration が中止した（アサートが正しく止めた）。 */
  SELECT count(*) INTO v_null_listed FROM public.ow_companies
   WHERE logo_url IS NULL AND is_published AND listing_status = 'listed' AND is_test = false;
  IF v_null_listed <> 2 THEN
    RAISE EXCEPTION '掲載中で logo_url が NULL の企業が % 社（2 のはず）。中止', v_null_listed;
  END IF;

  SELECT count(*) INTO v_null_all FROM public.ow_companies WHERE logo_url IS NULL;
  SELECT count(*) INTO v_total FROM public.ow_companies;
  RAISE NOTICE '適用前: NULL は掲載中 % 社 / 全体 % 社 / 全 % 行', v_null_listed, v_null_all, v_total;
END $$;

/* ⚠️ 対象は id で明示する。さらに `logo_url IS NULL` まで確認してから書く
      （既に値が入っていたら上書きしない）。 */
UPDATE public.ow_companies
   SET logo_url = 'https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/cb386dd2-427c-49d1-b3f8-1e1d3a921fd8/logo.png'
 WHERE id = 'cb386dd2-427c-49d1-b3f8-1e1d3a921fd8'
   AND logo_url IS NULL;

DO $$
DECLARE v_flyle text; v_pksha_null int; v_null_total int; v_null_all int; v_total int;
BEGIN
  SELECT logo_url INTO v_flyle FROM public.ow_companies
   WHERE id = 'cb386dd2-427c-49d1-b3f8-1e1d3a921fd8';
  IF v_flyle IS NULL OR v_flyle NOT LIKE '%/companies/logos/cb386dd2-427c-49d1-b3f8-1e1d3a921fd8/logo.png' THEN
    RAISE EXCEPTION 'フライルの logo_url が想定と違う（%）。中止', v_flyle;
  END IF;

  -- ★★PKSHA を触っていないこと。**これがこの migration のもう半分の目的**
  SELECT count(*) INTO v_pksha_null FROM public.ow_companies
   WHERE name = '株式会社PKSHA Technology' AND logo_url IS NULL;
  IF v_pksha_null <> 1 THEN RAISE EXCEPTION 'PKSHA の logo_url を触ってしまった。中止'; END IF;

  /* ★NULL が **掲載中で 2 → 1** に減ったこと（＝他社を巻き込んでいない）。
     ⚠️ **母集合を掲載中に限る。** 全88行だと非公開・is_test を含んで 11 → 10 になる。 */
  SELECT count(*) INTO v_null_total FROM public.ow_companies
   WHERE logo_url IS NULL AND is_published AND listing_status = 'listed' AND is_test = false;
  IF v_null_total <> 1 THEN
    RAISE EXCEPTION '掲載中で logo_url が NULL の企業が % 社（1 のはず）。中止', v_null_total;
  END IF;

  -- ★全体でもちょうど1件だけ減ったこと（掲載外を触っていない）
  SELECT count(*) INTO v_null_all FROM public.ow_companies WHERE logo_url IS NULL;
  IF v_null_all <> 10 THEN
    RAISE EXCEPTION '全体で NULL が % 社（11-1=10 のはず）。掲載外を巻き込んだ。中止', v_null_all;
  END IF;

  SELECT count(*) INTO v_total FROM public.ow_companies;
  IF v_total <> 88 THEN RAISE EXCEPTION 'ow_companies が % 行（88 のはず）。中止', v_total; END IF;

  RAISE NOTICE '完了: フライル設定済み / PKSHA は NULL のまま / NULL の企業 % 社 / 全 % 行',
    v_null_total, v_total;
END $$;

COMMIT;
