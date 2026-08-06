-- ═══════════════════════════════════════════════════════════════════════════
-- 会社独自呼称レイヤの準備：RLS の WITH CHECK 明示 + カラムの意味を COMMENT に残す
--
-- ── なぜ（2026-08-06）──────────────────────────────────────────────────────
-- 標準職種（ow_roles）は検索・集計のための共通軸で、会社が実際に使っている呼称とは
-- 一致しない。「CXデザイナー」のような呼称を求人に出したいが、
-- それを標準職種の名前に混ぜると検索軸が壊れる。
-- 表示は自社呼称・検索は標準職種、に分ける。
--
-- ⚠️ `ow_jobs.company_job_role_id` は **baseline に既にあった**（2362行目、
--    FK は ON DELETE SET NULL）。当初この migration で ADD COLUMN するつもりだったが、
--    事前チェックが「既にある」で止めた。参照は0件・コードからの参照も0件で、
--    受け皿だけ作られて放置されていた列。**新規追加はしない**。
--    ここでやるのは「意味を COMMENT に書く」ことと、下の RLS の明示だけ。
--
-- ── RLS の WITH CHECK ──────────────────────────────────────────────────────
-- ow_company_job_roles の "company admins manage job roles" は polcmd=ALL だが
-- USING しか書かれていない。Postgres は WITH CHECK 未指定のとき USING を流用するため
-- 現状も他社の行を作ることはできないが、**暗黙の流用に依存したままにしない**。
-- このあと求人の保存APIから INSERT / UPDATE するので、明示しておく。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_total int; v_null int; v_fk int; v_pol record;
BEGIN
  -- カラムと FK が baseline のまま存在すること
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='ow_jobs'
                    AND column_name='company_job_role_id') THEN
    RAISE EXCEPTION 'ow_jobs.company_job_role_id が無い。中止';
  END IF;

  SELECT count(*) INTO v_fk FROM pg_constraint
   WHERE conrelid = 'public.ow_jobs'::regclass
     AND confrelid = 'public.ow_company_job_roles'::regclass
     AND confdeltype = 'n';   -- n = SET NULL
  IF v_fk <> 1 THEN RAISE EXCEPTION 'FK が ON DELETE SET NULL になっていない。中止'; END IF;

  SELECT count(*), count(*) FILTER (WHERE company_job_role_id IS NULL)
    INTO v_total, v_null FROM public.ow_jobs;

  SELECT * INTO v_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_company_job_roles'
     AND policyname='company admins manage job roles';
  IF NOT FOUND THEN RAISE EXCEPTION '対象ポリシーが無い。中止'; END IF;
  IF v_pol.with_check IS NOT NULL THEN
    RAISE EXCEPTION 'ポリシーに既に WITH CHECK がある（%）。中止', v_pol.with_check;
  END IF;

  RAISE NOTICE '適用前: ow_jobs % 件（うち company_job_role_id IS NULL が % 件）/ WITH CHECK なし',
    v_total, v_null;
END $$;

COMMENT ON COLUMN public.ow_jobs.company_job_role_id IS
  'その会社での呼び方（ow_company_job_roles）への参照。表示にだけ使う。'
  ' ⚠️ 検索・フィルタ・スカウトの絞り込みは標準職種（ow_job_roles / role_category_id）のまま。'
  ' ⚠️ 参照先に deleted_at が入っている場合は呼称を使わず標準職種名にフォールバックすること。'
  ' ⚠️ baseline から存在していたが 2026-08-06 まで参照0件・書き込み0件だった。';

-- ── RLS の WITH CHECK を明示 ───────────────────────────────────────────────
DROP POLICY "company admins manage job roles" ON public.ow_company_job_roles;
CREATE POLICY "company admins manage job roles" ON public.ow_company_job_roles
  USING (public.auth_is_company_admin(company_id))
  WITH CHECK (public.auth_is_company_admin(company_id));

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_total int; v_null int; v_pol record;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE company_job_role_id IS NULL)
    INTO v_total, v_null FROM public.ow_jobs;
  IF v_total <> v_null THEN
    RAISE EXCEPTION '求人 % 件のうち % 件しか NULL でない。ロールバック', v_total, v_null;
  END IF;

  SELECT * INTO v_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_company_job_roles'
     AND policyname='company admins manage job roles';
  IF v_pol.with_check IS NULL THEN RAISE EXCEPTION 'WITH CHECK が入っていない。ロールバック'; END IF;
  IF v_pol.cmd <> 'ALL' THEN RAISE EXCEPTION 'ポリシーの対象が ALL でなくなっている（%）。ロールバック', v_pol.cmd; END IF;
  IF v_pol.qual IS NULL THEN RAISE EXCEPTION 'USING が消えている。ロールバック'; END IF;

  RAISE NOTICE '完了: ow_jobs % 件すべて company_job_role_id IS NULL / USING = % / WITH CHECK = %',
    v_total, v_pol.qual, v_pol.with_check;
END $$;

COMMIT;
