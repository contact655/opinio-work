-- ═══════════════════════════════════════════════════════════════════════════
-- ow_articles.read_min の DEFAULT 5 を外す（2026-08-28）
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- **読了時間を測っていない記事に「5分」が入る。** 画面には「5分で読める」
-- 「読了5分。」（meta description にも）と、**測っていない数字が事実として出る。**
-- CLAUDE.md「値が無いことを、ある値に置き換えない」。
--
-- ⚠️ アプリ側の `mapDbArticle` にも同じ `?? 5` があり、同じコミットで外した。
--    **片方だけ直しても意味が無い** —— コードを直しても、DB が INSERT 時に 5 を埋める。
--
-- 旧定義（戻すとき用）:
--     ALTER TABLE public.ow_articles ALTER COLUMN read_min SET DEFAULT 5;
--
-- ── ★既存の値は書き換えない ────────────────────────────────────────────────
-- 実測（2026-08-28）: **16件すべて非 NULL**。**入っている値は正しいデータ**なので
-- 触らない。「既定で入った 5 なのか、測った 5 なのか」は**もう区別できない**が、
-- 推測で NULL に戻すほうが害が大きい（CLAUDE.md「推測値を投入しない」の裏返し）。
-- ⚠️ **今後 INSERT される記事だけが NULL になりうる。**
--
-- ⚠️ 列は NULL 可のまま（元から `is_nullable = YES`）。NOT NULL にはしない。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260828-2228-ow_articles.sql（スキーマ+データ / 16行）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_default text; v_rows int; v_null int; v_nullable text;
BEGIN
  SELECT column_default, is_nullable INTO v_default, v_nullable
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_articles' AND column_name='read_min';

  IF v_default IS DISTINCT FROM '5' THEN
    RAISE EXCEPTION 'read_min の DEFAULT が %（''5'' のはず）。前提が違う。中止', v_default;
  END IF;
  IF v_nullable <> 'YES' THEN
    RAISE EXCEPTION 'read_min が NOT NULL になっている。前提が違う。中止';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE read_min IS NULL) INTO v_rows, v_null
    FROM public.ow_articles;
  RAISE NOTICE '適用前: DEFAULT=% / 記事 % 件 / NULL % 件', v_default, v_rows, v_null;
END $$;

ALTER TABLE public.ow_articles ALTER COLUMN read_min DROP DEFAULT;

COMMENT ON COLUMN public.ow_articles.read_min IS
  '読了時間（分）。⚠️ 既定値を持たせないこと（2026-08-28 に DEFAULT 5 を外した）。測っていない記事は NULL のままにする。アプリ側も mapDbArticle の ?? 5 を同時に外してあり、表示は値があるときだけ出る。';

DO $$
DECLARE v_default text; v_rows int; v_null int;
BEGIN
  SELECT column_default INTO v_default FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_articles' AND column_name='read_min';
  IF v_default IS NOT NULL THEN
    RAISE EXCEPTION 'DEFAULT が % のまま残っている。中止', v_default;
  END IF;

  -- ★既存の値を1件も変えていないこと
  SELECT count(*), count(*) FILTER (WHERE read_min IS NULL) INTO v_rows, v_null
    FROM public.ow_articles;
  IF v_rows <> 16 THEN RAISE EXCEPTION '記事が % 件（16 のはず）。中止', v_rows; END IF;
  IF v_null <> 0  THEN RAISE EXCEPTION 'NULL が % 件（0 のはず）。既存値を壊した。中止', v_null; END IF;

  RAISE NOTICE '完了: DEFAULT なし / 記事 % 件 / NULL % 件', v_rows, v_null;
END $$;

COMMIT;
