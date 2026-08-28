-- ═══════════════════════════════════════════════════════════════════════════
-- 生年が2箇所で食い違っていた実ユーザー1人を直す（2026-08-28）
--
-- ── 何が起きていたか ────────────────────────────────────────────────────────
-- 生藤 弘樹（`0c99e403-…`・**is_test ではない実ユーザー**）について:
--     `ow_users.birth_date`            = 1996-11-05  → 1996年
--     `ow_career_profiles.birth_year`  = 1991
-- **5年ずれていた。** 2026-08-20 に見つかり、「どちらが本人の申告か分からない」ため
-- データを変えずに保留していた（docs/todo.md）。
--
-- → **2026-08-28 に柴さんが「1996 です」と確定。** `ow_users` 側が正しかった。
--
-- ⚠️ 画面に出るのは `ow_users.birth_date` の側だけなので、**表示は元から正しかった。**
--    直すのは「食い違いが残っていること」自体で、表示バグの修正ではない。
--
-- ── なぜ NULL にせず 1996 を入れるのか ──────────────────────────────────────
-- CLAUDE.md は「**生年は `ow_users.birth_date` の1系統に決めた**。
-- `ow_career_profiles.birth_year` は表示にも集計にも使わない」としており、
-- この列を消す選択もありうる。**それでも値を合わせる側にした。**
--   * 消すと「未入力」に見え、**本人が答えていないのか運営が消したのかが分からなくなる**
--   * この列を将来読む経路ができたときに、NULL より正しい値が入っているほうが安全
-- ⚠️ **だからといって、ここを新しく読み書きしないこと。** 正は `ow_users.birth_date`。
--
-- ⚠️ `ow_career_profiles` は **全部で1行**（2026-08-28 実測）。その1行がこれ。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260828-1722-ow_career_profiles.sql（スキーマ+データ / 1行）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_rows int; v_before int; v_users_year int;
BEGIN
  SELECT count(*) INTO v_rows FROM public.ow_career_profiles;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'ow_career_profiles が % 行（1 のはず）。前提が違う。中止', v_rows; END IF;

  SELECT birth_year INTO v_before FROM public.ow_career_profiles
   WHERE user_id = '0c99e403-7540-4cf9-8bb1-67571af4f2b6';
  IF v_before IS DISTINCT FROM 1991 THEN
    RAISE EXCEPTION 'birth_year が % （1991 のはず）。前提が違う。中止', v_before;
  END IF;

  -- ★正の側が本当に 1996 であることを確かめてから寄せる
  SELECT extract(year from birth_date)::int INTO v_users_year FROM public.ow_users
   WHERE id = '0c99e403-7540-4cf9-8bb1-67571af4f2b6';
  IF v_users_year <> 1996 THEN
    RAISE EXCEPTION 'ow_users.birth_date の年が % （1996 のはず）。中止', v_users_year;
  END IF;

  RAISE NOTICE '適用前: career_profiles=% / users=%', v_before, v_users_year;
END $$;

-- ⚠️ 対象は id で明示する（条件で書くと、条件のほうが将来ずれる）
UPDATE public.ow_career_profiles
   SET birth_year = 1996
 WHERE user_id = '0c99e403-7540-4cf9-8bb1-67571af4f2b6'
   AND birth_year = 1991;   -- ★値まで確認してから書き換える

DO $$
DECLARE
  v_after int; v_conflict int; v_rows int;
BEGIN
  SELECT birth_year INTO v_after FROM public.ow_career_profiles
   WHERE user_id = '0c99e403-7540-4cf9-8bb1-67571af4f2b6';
  IF v_after <> 1996 THEN RAISE EXCEPTION 'birth_year が % のまま。中止', v_after; END IF;

  -- ★食い違いが 0 件になったこと（この migration の目的）
  SELECT count(*) INTO v_conflict FROM public.ow_career_profiles cp
    JOIN public.ow_users u ON u.id = cp.user_id
   WHERE cp.birth_year IS NOT NULL AND u.birth_date IS NOT NULL
     AND extract(year from u.birth_date)::int <> cp.birth_year;
  IF v_conflict <> 0 THEN RAISE EXCEPTION '食い違いが % 件残っている。中止', v_conflict; END IF;

  -- ★行を増やしても減らしてもいないこと
  SELECT count(*) INTO v_rows FROM public.ow_career_profiles;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'ow_career_profiles が % 行。中止', v_rows; END IF;

  RAISE NOTICE '完了: birth_year=% / 食い違い % 件 / % 行', v_after, v_conflict, v_rows;
END $$;

COMMIT;
