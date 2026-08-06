-- ═══════════════════════════════════════════════════════════════════════════
-- ユーザー投稿の給与レポートを削除する
--
-- ── なぜ（2026-08-06）──────────────────────────────────────────────────────
-- 給与データはユーザー投稿では持たない方針に決まった。
-- 投稿・審査・表示の導線は先に落としてある（commit 83783b57）。
-- アプリからの参照が0件になったので、テーブルを落とす。
--
-- ── 消える中身（DROP 直前の実測）────────────────────────────────────────────
-- ow_salary_reports … 1件
--   id           b1cb6956-ce69-48fb-9388-f32c1bd95d05
--   company_id   c3664ef1-5571-4645-b30f-1474e7961c17（株式会社セールスフォース・ジャパン）
--   user_id      e826e0bd-f96b-42ec-acda-d8f482e1417d
--   role_id      8db26a6b-e3c8-4b17-9a8a-5d306eb80b33
--   years_of_experience 4 / annual_salary 10000000 / ote 10000000
--   employment_status alumni / prefecture 東京都
--   is_approved true / is_flagged false
--   created_at 2026-07-14T15:48:18.536604+00:00
--   updated_at 2026-07-14T18:55:57.129016+00:00
--   （base_salary / bonus_salary / incentive / stock_options / proxy_note /
--     start_year_month / end_year_month / grade / achievement_rate /
--     allowances / fixed_overtime はすべて null）
-- ow_salary_reports_archive_20260714 … 0件
--
-- ── 触らないもの ────────────────────────────────────────────────────────────
-- ⚠️ ow_jobs の年収レンジ（求人票の賃金。職業安定法の明示事項）
-- ⚠️ ow_placements.annual_salary / fee_amount（就職実績の内部データ）
-- ⚠️ ow_job_applications.hired_salary
-- ⚠️ ow_profiles.desired_salary_min / max（希望年収）
-- ⚠️ ow_companies.avg_salary
-- ⚠️ ow_experiences.salary_man / visibility_salary（入力UIだけ外した。列とデータは残す）
--
-- ── 被参照 ─────────────────────────────────────────────────────────────────
-- このテーブルを参照している FK は 0 本（自分が持つ FK は company_id / user_id / role_id の3本）。
-- したがって DROP は他テーブルを巻き込まない。事前チェックで実際に確認する。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_rows int; v_arch int; v_inbound int; v_names text;
BEGIN
  IF to_regclass('public.ow_salary_reports') IS NULL THEN
    RAISE EXCEPTION 'ow_salary_reports が無い。既に削除済み？中止';
  END IF;

  SELECT count(*) INTO v_rows FROM public.ow_salary_reports;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'ow_salary_reports が % 件（想定1件）。中身が変わっている。中止', v_rows;
  END IF;

  SELECT count(*) INTO v_arch FROM public.ow_salary_reports_archive_20260714;
  IF v_arch <> 0 THEN
    RAISE EXCEPTION 'archive が % 件（想定0件）。中身が増えている。中止', v_arch;
  END IF;

  -- ⚠️ 被参照 FK があれば止める。CASCADE で他テーブルを巻き込まないため
  SELECT count(*), string_agg(conrelid::regclass::text || '.' || conname, ' / ')
    INTO v_inbound, v_names
    FROM pg_constraint
   WHERE contype = 'f'
     AND confrelid IN ('public.ow_salary_reports'::regclass,
                       'public.ow_salary_reports_archive_20260714'::regclass);
  IF v_inbound <> 0 THEN
    RAISE EXCEPTION '参照している FK が % 本ある（%）。中止', v_inbound, v_names;
  END IF;

  RAISE NOTICE '適用前: ow_salary_reports % 件 / archive % 件 / 被参照FK % 本', v_rows, v_arch, v_inbound;
END $$;

-- ── DROP ───────────────────────────────────────────────────────────────────
-- ⚠️ CASCADE は付けない。被参照0本を上で確認済みなので、素の DROP で落ちる。
--    落ちなければ想定外の依存があるということなので、そこで止まってよい。
DROP TABLE public.ow_salary_reports;
DROP TABLE public.ow_salary_reports_archive_20260714;

-- 付随物。テーブルと一緒に消えるもの（インデックス・ポリシー・トリガー）は明示不要だが、
-- トリガー関数はテーブルに属さないので残る。他に使っていないので落とす。
DROP FUNCTION IF EXISTS public.set_salary_reports_updated_at();

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_pol int; v_fn int;
BEGIN
  IF to_regclass('public.ow_salary_reports') IS NOT NULL THEN
    RAISE EXCEPTION 'ow_salary_reports が残っている。ロールバック';
  END IF;
  IF to_regclass('public.ow_salary_reports_archive_20260714') IS NOT NULL THEN
    RAISE EXCEPTION 'archive が残っている。ロールバック';
  END IF;

  SELECT count(*) INTO v_pol FROM pg_policies
   WHERE schemaname = 'public' AND tablename LIKE 'ow_salary_reports%';
  IF v_pol <> 0 THEN RAISE EXCEPTION 'ポリシーが % 本残っている。ロールバック', v_pol; END IF;

  SELECT count(*) INTO v_fn FROM pg_proc WHERE proname = 'set_salary_reports_updated_at';
  IF v_fn <> 0 THEN RAISE EXCEPTION 'トリガー関数が残っている。ロールバック'; END IF;

  -- 触らないはずのものが残っていること
  IF to_regclass('public.ow_placements') IS NULL THEN RAISE EXCEPTION 'ow_placements が消えた。ロールバック'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='ow_jobs' AND column_name='salary_min') THEN
    RAISE EXCEPTION 'ow_jobs.salary_min が消えた。ロールバック';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='ow_experiences' AND column_name='salary_man') THEN
    RAISE EXCEPTION 'ow_experiences.salary_man が消えた。ロールバック';
  END IF;

  RAISE NOTICE '完了: ow_salary_reports と archive を削除。ow_jobs / ow_placements / ow_experiences は無傷';
END $$;

COMMIT;
