-- ═══════════════════════════════════════════════════════════════════════════
-- merge_role() から削除済みテーブルの参照を落とし、孤児関数2本を DROP する
--
-- ── なぜ（2026-08-07）──────────────────────────────────────────────────────
-- ① merge_role() が `UPDATE ow_salary_reports` を持っていた。
--    このテーブルは 2026-08-06 の 20260806160000_drop_salary_reports.sql で
--    DROP 済みで、**全職種の統合が `relation "ow_salary_reports" does not exist`
--    で失敗していた**（約1日）。
--
--    ⚠️ **PL/pgSQL の本体は Postgres が依存として追跡しない。**
--       DROP TABLE は成功し、関数を実際に呼ぶまでエラーにならない。
--       FK を見ただけでは足りない。DROP する前に pg_proc.prosrc /
--       ビュー定義 / トリガー / ポリシーの全文を検索すること。
--
-- ② grant_review_access_on_post / has_review_access は
--    `ow_review_access` `ow_company_reviews` を参照しているが、
--    **この2テーブルは baseline にも無く、どの migration でも作られていない**
--    （このプロジェクトに一度も存在しない）。呼べば必ず落ちる。
--    トリガーにもポリシーにも紐づいていない孤児なので削除する。
--    残すと「使えるつもりで呼ぶ」事故のもとになる。
--
-- ⚠️ ow_company_reviews を読んでいたアプリ側の2箇所（getCompanyReviewSummaries /
--    admin の口コミ審査待ちKPI）は同じコミットで削除した。
--    口コミ機能をやると決めたときに改めて設計する。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_trg int; v_pol int; v_called int; v_roles int; v_alias int;
BEGIN
  IF to_regclass('public.ow_salary_reports') IS NOT NULL THEN
    RAISE EXCEPTION 'ow_salary_reports がまだ存在する。前提が違う。中止';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                  WHERE n.nspname='public' AND p.proname='merge_role') THEN
    RAISE EXCEPTION 'merge_role が無い。中止';
  END IF;

  -- ⚠️ DROP する2関数が、トリガー／ポリシー／他の関数から参照されていないこと。
  --    1つでもあれば中止する（黙って壊さない）。
  SELECT count(*) INTO v_trg FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
   WHERE NOT t.tgisinternal
     AND p.proname IN ('grant_review_access_on_post','has_review_access');
  IF v_trg > 0 THEN RAISE EXCEPTION '削除対象の関数がトリガー % 件から使われている。中止', v_trg; END IF;

  SELECT count(*) INTO v_pol FROM pg_policies
   WHERE schemaname='public'
     AND (coalesce(qual,'')||coalesce(with_check,'')) ~ '(grant_review_access_on_post|has_review_access)';
  IF v_pol > 0 THEN RAISE EXCEPTION '削除対象の関数がポリシー % 件から使われている。中止', v_pol; END IF;

  SELECT count(*) INTO v_called FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND p.proname NOT IN ('grant_review_access_on_post','has_review_access')
     AND p.prosrc ~ '(grant_review_access_on_post|has_review_access)';
  IF v_called > 0 THEN RAISE EXCEPTION '削除対象の関数が他の関数 % 件から呼ばれている。中止', v_called; END IF;

  SELECT count(*) INTO v_roles FROM public.ow_roles;
  SELECT count(*) INTO v_alias FROM public.ow_role_aliases;
  IF v_roles <> 105 THEN RAISE EXCEPTION 'ow_roles が % 件（想定105）。中止', v_roles; END IF;
  IF v_alias <> 120 THEN RAISE EXCEPTION 'ow_role_aliases が % 件（想定120）。中止', v_alias; END IF;

  RAISE NOTICE '適用前: ow_roles % 件 / 別名 % 件 / 孤児関数の参照 トリガー0・ポリシー0・関数0',
    v_roles, v_alias;
END $$;

-- ── ① merge_role から ow_salary_reports の参照を落とす ──────────────────────
CREATE OR REPLACE FUNCTION public.merge_role(from_role_id uuid, to_role_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_from record;
  v_to   record;
  v_children int;
  v_jobs int; v_job_roles int; v_exp int; v_exp_roles int;
  v_cats int; v_placements int; v_cjr int; v_alias int;
BEGIN
  -- ── ① 検証 ──────────────────────────────────────────────────────────────
  IF from_role_id IS NULL OR to_role_id IS NULL THEN
    RAISE EXCEPTION '統合元と統合先の両方が必要';
  END IF;
  IF from_role_id = to_role_id THEN
    RAISE EXCEPTION '同じ職種には統合できない';
  END IF;

  SELECT * INTO v_from FROM ow_roles WHERE id = from_role_id;
  IF NOT FOUND THEN RAISE EXCEPTION '統合元の職種が見つからない（%）', from_role_id; END IF;

  SELECT * INTO v_to FROM ow_roles WHERE id = to_role_id;
  IF NOT FOUND THEN RAISE EXCEPTION '統合先の職種が見つからない（%）', to_role_id; END IF;

  IF NOT v_to.is_active THEN
    RAISE EXCEPTION '統合先「%」は無効な職種。有効な職種にしか統合できない', v_to.name;
  END IF;

  -- ⚠️ 子を持つ職種は統合させない。子ごと巻き込むと、子の親が消えて
  --    どこにも属さない職種になる。先に子を処理させる。
  SELECT count(*) INTO v_children FROM ow_roles WHERE parent_id = from_role_id;
  IF v_children > 0 THEN
    RAISE EXCEPTION '「%」には子職種が % 件ある。先に子を統合するか付け替えること',
      v_from.name, v_children;
  END IF;

  -- ── ② 参照の付け替え ────────────────────────────────────────────────────
  --    ⚠️ 参照元は pg_constraint（confrelid = 'ow_roles'）で洗い出した全件。
  --       テーブルを足したらここにも足すこと。漏れると統合後に無効な職種を指す行が残る。
  --    ⚠️ **テーブルを DROP したらここからも消すこと。**
  --       PL/pgSQL の本体は依存として追跡されないので DROP は成功し、
  --       統合を実行するまでエラーにならない（2026-08-06〜07 に実際に壊れていた）。

  UPDATE ow_jobs SET role_category_id = to_role_id WHERE role_category_id = from_role_id;
  GET DIAGNOSTICS v_jobs = ROW_COUNT;

  -- ow_job_roles は PK (job_id, role_id)。付け替え先が既にある行は消してから移す。
  -- ⚠️ 統合元が is_primary だった場合は、統合先を主に昇格させてから消す。
  UPDATE ow_job_roles t SET is_primary = true
   WHERE t.role_id = to_role_id
     AND EXISTS (SELECT 1 FROM ow_job_roles x
                  WHERE x.job_id = t.job_id AND x.role_id = from_role_id AND x.is_primary);
  DELETE FROM ow_job_roles t
   WHERE t.role_id = from_role_id
     AND EXISTS (SELECT 1 FROM ow_job_roles x WHERE x.job_id = t.job_id AND x.role_id = to_role_id);
  UPDATE ow_job_roles SET role_id = to_role_id WHERE role_id = from_role_id;
  GET DIAGNOSTICS v_job_roles = ROW_COUNT;

  UPDATE ow_experiences SET role_category_id = to_role_id WHERE role_category_id = from_role_id;
  GET DIAGNOSTICS v_exp = ROW_COUNT;

  -- ow_experience_roles は PK (experience_id, role_id)
  DELETE FROM ow_experience_roles t
   WHERE t.role_id = from_role_id
     AND EXISTS (SELECT 1 FROM ow_experience_roles x
                  WHERE x.experience_id = t.experience_id AND x.role_id = to_role_id);
  UPDATE ow_experience_roles SET role_id = to_role_id WHERE role_id = from_role_id;
  GET DIAGNOSTICS v_exp_roles = ROW_COUNT;

  -- ow_company_employee_categories は UNIQUE (company_id, role_id)
  DELETE FROM ow_company_employee_categories t
   WHERE t.role_id = from_role_id
     AND EXISTS (SELECT 1 FROM ow_company_employee_categories x
                  WHERE x.company_id = t.company_id AND x.role_id = to_role_id);
  UPDATE ow_company_employee_categories SET role_id = to_role_id WHERE role_id = from_role_id;
  GET DIAGNOSTICS v_cats = ROW_COUNT;
  UPDATE ow_company_employee_categories SET parent_role_id = to_role_id WHERE parent_role_id = from_role_id;

  -- ⚠️ ow_salary_reports の付け替えはここにあったが、2026-08-06 に DROP 済みのため削除した。

  UPDATE ow_placements SET current_role_id = to_role_id WHERE current_role_id = from_role_id;
  GET DIAGNOSTICS v_placements = ROW_COUNT;
  UPDATE ow_placements SET previous_role_id = to_role_id WHERE previous_role_id = from_role_id;

  UPDATE ow_company_job_roles SET standard_role_id = to_role_id WHERE standard_role_id = from_role_id;
  GET DIAGNOSTICS v_cjr = ROW_COUNT;

  -- ── ③ 統合元の名前と別名を、統合先の別名として引き継ぐ ────────────────────
  --    ⚠️ UNIQUE (role_id, alias) があるので NOT EXISTS で重複を弾く。
  --    ⚠️ 統合先と同じ名前は入れない（自分自身を別名にしても意味がない）。
  INSERT INTO ow_role_aliases (role_id, alias)
  SELECT to_role_id, x.alias
    FROM (
      SELECT v_from.name AS alias
      UNION
      SELECT a.alias FROM ow_role_aliases a WHERE a.role_id = from_role_id
    ) x
   WHERE x.alias <> v_to.name
     AND NOT EXISTS (SELECT 1 FROM ow_role_aliases b
                      WHERE b.role_id = to_role_id AND b.alias = x.alias);
  GET DIAGNOSTICS v_alias = ROW_COUNT;

  -- ── ④ 統合元を論理削除 ──────────────────────────────────────────────────
  UPDATE ow_roles
     SET is_active = false, merged_into_id = to_role_id
   WHERE id = from_role_id;

  RETURN jsonb_build_object(
    'from', v_from.name, 'to', v_to.name,
    'jobs', v_jobs, 'job_roles', v_job_roles,
    'experiences', v_exp, 'experience_roles', v_exp_roles,
    'employee_categories', v_cats,
    'placements', v_placements, 'company_job_roles', v_cjr,
    'aliases_added', v_alias
  );
END $function$;

ALTER FUNCTION public.merge_role(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.merge_role(uuid, uuid) FROM PUBLIC;
-- ⚠️ service_role だけに EXECUTE を与える（API は createAdminClient から呼ぶ）
GRANT EXECUTE ON FUNCTION public.merge_role(uuid, uuid) TO service_role;

-- ── ② 孤児関数を DROP ───────────────────────────────────────────────────────
-- ⚠️ CASCADE は使わない。依存物を黙って道連れにするため。
--    事前チェックで参照0件を確認済み。
DROP FUNCTION IF EXISTS public.grant_review_access_on_post();
DROP FUNCTION IF EXISTS public.has_review_access(uuid);
DROP FUNCTION IF EXISTS public.has_review_access();

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_bad int; v_left int; v_roles int; v_alias int; v_exec int;
BEGIN
  -- merge_role に削除済みテーブルの参照が残っていないこと
  SELECT count(*) INTO v_bad FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='merge_role' AND p.prosrc LIKE '%ow_salary_reports%';
  IF v_bad <> 0 THEN RAISE EXCEPTION 'merge_role に ow_salary_reports が残っている。ロールバック'; END IF;

  -- 孤児関数が消えたこと
  SELECT count(*) INTO v_left FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('grant_review_access_on_post','has_review_access');
  IF v_left <> 0 THEN RAISE EXCEPTION '孤児関数が % 件残っている。ロールバック', v_left; END IF;

  -- ⚠️ **存在しない ow_* を参照する関数・ビュー・ポリシーが1つも無いこと。**
  --    今後 DROP したときにこの migration と同じ形の穴が空いていないかを、
  --    ここで機械的に検査する。
  SELECT count(*) INTO v_bad FROM (
    SELECT DISTINCT m[1] AS obj FROM (
      SELECT p.prosrc AS body FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.prosrc IS NOT NULL
      UNION ALL SELECT v.definition FROM pg_views v WHERE v.schemaname='public'
      UNION ALL SELECT mv.definition FROM pg_matviews mv WHERE mv.schemaname='public'
      UNION ALL SELECT coalesce(pol.qual,'')||' '||coalesce(pol.with_check,'')
                  FROM pg_policies pol WHERE pol.schemaname='public'
    ) s, LATERAL regexp_matches(s.body, '\mow_[a-z0-9_]+\M', 'g') m
  ) t
  WHERE to_regclass('public.'||obj) IS NULL
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema='public' AND column_name = t.obj);
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '存在しない ow_* を参照する関数・ビュー・ポリシーが % 件ある。ロールバック', v_bad;
  END IF;

  -- merge_role の EXECUTE が service_role に残っていること
  SELECT count(*) INTO v_exec FROM information_schema.role_routine_grants
   WHERE routine_schema='public' AND routine_name='merge_role' AND grantee='service_role';
  IF v_exec = 0 THEN RAISE EXCEPTION 'merge_role の EXECUTE が service_role に無い。ロールバック'; END IF;

  -- データを触っていないこと
  SELECT count(*) INTO v_roles FROM public.ow_roles;
  SELECT count(*) INTO v_alias FROM public.ow_role_aliases;
  IF v_roles <> 105 THEN RAISE EXCEPTION 'ow_roles が % 件（想定105）。ロールバック', v_roles; END IF;
  IF v_alias <> 120 THEN RAISE EXCEPTION 'ow_role_aliases が % 件（想定120）。ロールバック', v_alias; END IF;

  RAISE NOTICE '完了: merge_role を修復 / 孤児関数2本を削除 / 存在しない ow_* の参照 0 件 / ow_roles % 件・別名 % 件は変更なし',
    v_roles, v_alias;
END $$;

COMMIT;
