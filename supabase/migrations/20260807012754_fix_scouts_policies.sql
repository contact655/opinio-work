-- ═══════════════════════════════════════════════════════════════════════════
-- ow_scouts のポリシーを ow_companies.user_id から auth_is_company_admin に寄せる
-- ＋ ow_scouts / ow_matches に運営（admin）の読み取りを足す
--
-- ── なぜ（2026-08-07）──────────────────────────────────────────────────────
-- ow_scouts の company 系3本が `company_id IN (SELECT id FROM ow_companies
-- WHERE user_id = auth.uid())` を見ていた。
-- **ow_companies.user_id は 85社中 2社にしか入っていない**（実測）。
-- 残り83社では、企業は自社宛のスカウトを1件も読めず、送ることもできない。
--
-- D-2 の実測で「企業担当者が読めた」のは、
-- たまたま Opinio がその2社のうちの1社だったから。
-- 検証を自社だけで回すと「たまたま動く条件」を引く典型例だった。
--
-- ⚠️ user_id は「会社レコードを最初に作った人」であって、担当者の一覧ではない。
--    実際 Opinio の user_id が指すアカウントは ow_company_admins 上では
--    is_active = false（＝すでに担当を外れている人）だった。
--    つまり現行ポリシーは「担当を外れた1人だけが読める」状態でもあった。
--
-- ⚠️ candidate 系（auth.uid() = candidate_id）は空間が正しいので変更しない。
--    ow_scouts.candidate_id は auth.users を指す FK（auth.uid() 空間）。
--
-- ── 意味の変化 ──────────────────────────────────────────────────────────────
--   変更前: 会社レコードの作成者1人（is_active も permission も見ない）
--   変更後: auth_is_company_admin() ＝ permission='admin' AND is_active=true
--   /biz 側の requireAdmin と同じ判定に揃う。
--
-- ── ow_companies.user_id に依存している残りのポリシー（今回は触らない）────────
--   ow_jobs                  own_select/insert/update/delete  4本
--     → ow_jobs_company_admin_manage(ALL) が正しい空間で存在するため機能欠落なし
--   ow_job_requirements      own_*  4本
--   ow_job_matching_tags     own_*  4本
--   ow_company_culture_tags  own_*  4本
--     → いずれも public_read があり読みは通る。書きは壊れているが、
--       この3テーブルを session 経由で書くコードは 0 件
--       （ow_company_culture_tags の唯一の参照 api/company/me は admin クライアント、
--         かつ現在どこからも呼ばれていない）。
--       機能を復活させるときに、この migration と同じ形へ寄せること。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_scout_pol int; v_match_pol int; v_uid int; v_total int; v_rows int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='auth_is_company_admin') THEN
    RAISE EXCEPTION 'auth_is_company_admin が無い。中止';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='auth_is_admin') THEN
    RAISE EXCEPTION 'auth_is_admin が無い。中止';
  END IF;

  SELECT count(*) INTO v_scout_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_scouts';
  IF v_scout_pol <> 4 THEN RAISE EXCEPTION 'ow_scouts のポリシーが % 本（想定4）。中止', v_scout_pol; END IF;

  SELECT count(*) INTO v_match_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_matches';
  IF v_match_pol <> 3 THEN RAISE EXCEPTION 'ow_matches のポリシーが % 本（想定3）。中止', v_match_pol; END IF;

  -- 前提（この migration の理由そのもの）が今も成立していること
  SELECT count(*) FILTER (WHERE user_id IS NOT NULL), count(*) INTO v_uid, v_total
    FROM public.ow_companies;
  IF v_uid >= v_total THEN
    RAISE EXCEPTION 'ow_companies.user_id が全社に入っている（%/%）。前提が変わった。中止', v_uid, v_total;
  END IF;

  SELECT count(*) INTO v_rows FROM public.ow_scouts;
  RAISE NOTICE '適用前: ow_companies.user_id は %/% 社 / ow_scouts % 件 / ポリシー scouts=% matches=%',
    v_uid, v_total, v_rows, v_scout_pol, v_match_pol;
END $$;

-- ── ① ow_scouts の company 系3本 ────────────────────────────────────────────
DROP POLICY "ow_scouts_company_select" ON public.ow_scouts;
CREATE POLICY "ow_scouts_company_select" ON public.ow_scouts
  FOR SELECT TO authenticated
  USING (public.auth_is_company_admin(company_id));

DROP POLICY "ow_scouts_company_insert" ON public.ow_scouts;
CREATE POLICY "ow_scouts_company_insert" ON public.ow_scouts
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_company_admin(company_id));

DROP POLICY "ow_scouts_company_update" ON public.ow_scouts;
CREATE POLICY "ow_scouts_company_update" ON public.ow_scouts
  FOR UPDATE TO authenticated
  USING (public.auth_is_company_admin(company_id))
  WITH CHECK (public.auth_is_company_admin(company_id));
-- ⚠️ 元の UPDATE には WITH CHECK が無く、company_id を他社に書き換えて
--    行を移せる形だった。ここで塞ぐ。

-- ── ② 運営の読み取り ────────────────────────────────────────────────────────
-- スカウトは運営が仲介する前提の機能なのに、admin ポリシーが1本も無く
-- 運営が調査もできなかった。
CREATE POLICY "ow_scouts_admin_read" ON public.ow_scouts
  FOR SELECT USING (public.auth_is_admin());

CREATE POLICY "ow_matches_admin_read" ON public.ow_matches
  FOR SELECT USING (public.auth_is_admin());

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_scout_pol int; v_match_pol int; v_bad int; v_names text; v_rows int;
BEGIN
  SELECT count(*) INTO v_scout_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_scouts';
  IF v_scout_pol <> 5 THEN RAISE EXCEPTION 'ow_scouts のポリシーが % 本（想定5）。ロールバック', v_scout_pol; END IF;

  SELECT count(*) INTO v_match_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_matches';
  IF v_match_pol <> 4 THEN RAISE EXCEPTION 'ow_matches のポリシーが % 本（想定4）。ロールバック', v_match_pol; END IF;

  -- ow_companies.user_id への依存が ow_scouts に残っていないこと
  SELECT count(*), string_agg(policyname, ' / ') INTO v_bad, v_names
    FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_scouts'
     AND (coalesce(qual,'') LIKE '%ow_companies%' OR coalesce(with_check,'') LIKE '%ow_companies%');
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'ow_companies.user_id 依存が % 本残っている（%）。ロールバック', v_bad, v_names;
  END IF;

  -- 候補者本人のポリシーを消していないこと
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='ow_scouts'
                    AND policyname='ow_scouts_candidate_read') THEN
    RAISE EXCEPTION 'ow_scouts_candidate_read が消えた。ロールバック';
  END IF;

  -- UPDATE に WITH CHECK が入ったこと
  IF (SELECT coalesce(with_check,'') FROM pg_policies
       WHERE schemaname='public' AND tablename='ow_scouts'
         AND policyname='ow_scouts_company_update') = '' THEN
    RAISE EXCEPTION 'ow_scouts_company_update に WITH CHECK が無い。ロールバック';
  END IF;

  -- データを触っていないこと
  SELECT count(*) INTO v_rows FROM public.ow_scouts;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ow_scouts が % 件（想定0）。ロールバック', v_rows; END IF;

  RAISE NOTICE '完了: ow_scouts の company 系3本を auth_is_company_admin へ / admin 読み取りを ow_scouts・ow_matches に追加';
END $$;

COMMIT;
