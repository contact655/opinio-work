-- ═══════════════════════════════════════════════════════════════════════════
-- ① AIプロダクトマネージャーを「データ・AI」→「プロダクト」へ移す
-- ② ow_jobs.job_category を主ロール名から再派生し、merge_role にも組み込む
--
-- ── ① なぜ（2026-08-07）────────────────────────────────────────────────────
-- 「AIプロダクトマネージャー」が データ・AI 配下にあり、
-- **PM を探す人の導線から外れていた**（PdM / PMM / グロースPM / テクニカルPM は
-- すべて プロダクト 配下）。求人票としての実在は確認済み（PKSHA / ジーニー / 電通）。
--
-- ⚠️ **統合ではなく移動。** merged_into_id は使わない。
--    統合すると職種そのものが消えるが、ここでやりたいのは置き場所の変更だけ。
-- ⚠️ 移動後に3階層にならないこと（移動先が大分類であること）を確認する。
--
-- ── ② なぜ ────────────────────────────────────────────────────────────────
-- ow_jobs.job_category の7件が**統合済みで無効な職種名**を指したままだった
-- （セールスエンジニア3 / ソリューションズアーキテクト2 / ソリューションエンジニア2。
--   いずれも 2026-08-06 に ソリューションエンジニア・プリセールス へ統合済み）。
-- job_category は ow_job_roles の主ロール名から派生させる表示用の値
-- （lib/business/deriveJobCategory.ts と同じロジック）。統合時に更新していなかった。
--
-- ⚠️ **merge_role() にも同じ再派生を組み込む。**
--    組み込まないと統合のたびに同じズレが再発する。
-- ⚠️ job_category は廃止予定の列。ここで**依存を増やさない**方針なので、
--    /salary の CATEGORY_TO_SLUG に新しい職種名を足すことはしない
--    （該当7件は「その他」に落ちる。/salary を ow_job_roles ベースに
--      作り替えるときにまとめて解決する）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_ai record; v_prod uuid; v_kids int; v_mismatch int; v_roles int;
BEGIN
  SELECT r.id, r.parent_id, r.display_order, r.level INTO v_ai
    FROM public.ow_roles r WHERE r.name='AIプロダクトマネージャー' AND r.is_active;
  IF v_ai.id IS NULL THEN RAISE EXCEPTION 'AIプロダクトマネージャーが無い。中止'; END IF;

  IF v_ai.parent_id <> (SELECT id FROM public.ow_roles WHERE name='データ・AI' AND parent_id IS NULL) THEN
    RAISE EXCEPTION 'AIプロダクトマネージャーの親が「データ・AI」でない。既に移動済み？中止';
  END IF;

  -- ⚠️ 子を持っていたら移動で3階層になる
  SELECT count(*) INTO v_kids FROM public.ow_roles WHERE parent_id = v_ai.id;
  IF v_kids <> 0 THEN RAISE EXCEPTION 'AIプロダクトマネージャーに子が % 件ある。中止', v_kids; END IF;

  -- 移動先が大分類（parent_id IS NULL）であること
  SELECT id INTO v_prod FROM public.ow_roles WHERE name='プロダクト' AND parent_id IS NULL AND is_active;
  IF v_prod IS NULL THEN RAISE EXCEPTION '大分類「プロダクト」が無い。中止'; END IF;

  -- job_category のズレが7件であること
  SELECT count(*) INTO v_mismatch
    FROM public.ow_jobs j
    JOIN public.ow_job_roles jr ON jr.job_id = j.id AND jr.is_primary
    JOIN public.ow_roles r ON r.id = jr.role_id
   WHERE j.job_category IS DISTINCT FROM r.name;
  IF v_mismatch <> 7 THEN RAISE EXCEPTION 'job_category のズレが % 件（想定7）。中止', v_mismatch; END IF;

  SELECT count(*) INTO v_roles FROM public.ow_roles;
  RAISE NOTICE '適用前: ow_roles % 件 / job_category のズレ % 件', v_roles, v_mismatch;
END $$;

-- ── ① AIプロダクトマネージャーを移動 ────────────────────────────────────────
-- PM系の並びに入れる: PdM(1) / PMM(2) / グロースPM(3) / テクニカルPM(4) /
--                     AIプロダクトマネージャー(5) / PjM(6) / UXリサーチャー(7)
UPDATE public.ow_roles SET display_order = display_order + 1
 WHERE parent_id = (SELECT id FROM public.ow_roles WHERE name='プロダクト' AND parent_id IS NULL)
   AND display_order >= 5;

UPDATE public.ow_roles
   SET parent_id = (SELECT id FROM public.ow_roles WHERE name='プロダクト' AND parent_id IS NULL),
       display_order = 5
 WHERE name = 'AIプロダクトマネージャー' AND is_active;

-- ── ② job_category を主ロール名から再派生 ──────────────────────────────────
UPDATE public.ow_jobs j
   SET job_category = r.name
  FROM public.ow_job_roles jr
  JOIN public.ow_roles r ON r.id = jr.role_id
 WHERE jr.job_id = j.id AND jr.is_primary
   AND j.job_category IS DISTINCT FROM r.name;

-- ── ②' merge_role に job_category の再派生を組み込む ────────────────────────
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
  v_cats int; v_placements int; v_cjr int; v_alias int; v_category int;
BEGIN
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

  -- ── 参照の付け替え ──────────────────────────────────────────────────────
  --    ⚠️ 参照元は pg_constraint（confrelid = 'ow_roles'）で洗い出した全件。
  --    ⚠️ **テーブルを DROP したらここからも消すこと。** PL/pgSQL の本体は
  --       依存として追跡されないので DROP は成功し、統合を実行するまで落ちない
  --       （2026-08-06〜07 に ow_salary_reports で実際に壊れていた）。

  UPDATE ow_jobs SET role_category_id = to_role_id WHERE role_category_id = from_role_id;
  GET DIAGNOSTICS v_jobs = ROW_COUNT;

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

  DELETE FROM ow_experience_roles t
   WHERE t.role_id = from_role_id
     AND EXISTS (SELECT 1 FROM ow_experience_roles x
                  WHERE x.experience_id = t.experience_id AND x.role_id = to_role_id);
  UPDATE ow_experience_roles SET role_id = to_role_id WHERE role_id = from_role_id;
  GET DIAGNOSTICS v_exp_roles = ROW_COUNT;

  DELETE FROM ow_company_employee_categories t
   WHERE t.role_id = from_role_id
     AND EXISTS (SELECT 1 FROM ow_company_employee_categories x
                  WHERE x.company_id = t.company_id AND x.role_id = to_role_id);
  UPDATE ow_company_employee_categories SET role_id = to_role_id WHERE role_id = from_role_id;
  GET DIAGNOSTICS v_cats = ROW_COUNT;
  UPDATE ow_company_employee_categories SET parent_role_id = to_role_id WHERE parent_role_id = from_role_id;

  UPDATE ow_placements SET current_role_id = to_role_id WHERE current_role_id = from_role_id;
  GET DIAGNOSTICS v_placements = ROW_COUNT;
  UPDATE ow_placements SET previous_role_id = to_role_id WHERE previous_role_id = from_role_id;

  UPDATE ow_company_job_roles SET standard_role_id = to_role_id WHERE standard_role_id = from_role_id;
  GET DIAGNOSTICS v_cjr = ROW_COUNT;

  -- ── 統合元の名前と別名を、統合先の別名として引き継ぐ ──────────────────────
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

  -- ── 統合元を論理削除 ────────────────────────────────────────────────────
  UPDATE ow_roles
     SET is_active = false, merged_into_id = to_role_id
   WHERE id = from_role_id;

  /* ── ⚠️ job_category を主ロール名から再派生する（2026-08-07 追加）──────────
        これが無いと、統合のたびに job_category が
        **無効になった職種名を指したまま**残る。実際 2026-08-06 の統合で
        7件がズレていた。lib/business/deriveJobCategory.ts と同じ考え方。
        job_category は廃止予定の派生値なので、ここで揃えるだけにする。 */
  UPDATE ow_jobs j
     SET job_category = r.name
    FROM ow_job_roles jr
    JOIN ow_roles r ON r.id = jr.role_id
   WHERE jr.job_id = j.id AND jr.is_primary
     AND j.job_category IS DISTINCT FROM r.name;
  GET DIAGNOSTICS v_category = ROW_COUNT;

  RETURN jsonb_build_object(
    'from', v_from.name, 'to', v_to.name,
    'jobs', v_jobs, 'job_roles', v_job_roles,
    'experiences', v_exp, 'experience_roles', v_exp_roles,
    'employee_categories', v_cats,
    'placements', v_placements, 'company_job_roles', v_cjr,
    'aliases_added', v_alias, 'job_category_resynced', v_category
  );
END $function$;

ALTER FUNCTION public.merge_role(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.merge_role(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_role(uuid, uuid) TO service_role;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_depth int; v_mismatch int; v_invalid int; v_roles int; v_order text; v_parent text;
BEGIN
  -- ① 親が「プロダクト」に変わったこと
  SELECT p.name INTO v_parent FROM public.ow_roles r JOIN public.ow_roles p ON p.id = r.parent_id
   WHERE r.name='AIプロダクトマネージャー';
  IF v_parent <> 'プロダクト' THEN RAISE EXCEPTION '親が % のまま。ロールバック', v_parent; END IF;

  -- ⚠️ 3階層になっていないこと（親がさらに親を持たない）
  SELECT count(*) INTO v_depth
    FROM public.ow_roles r
    JOIN public.ow_roles p ON p.id = r.parent_id
   WHERE p.parent_id IS NOT NULL;
  IF v_depth <> 0 THEN RAISE EXCEPTION '3階層の職種が % 件ある。ロールバック', v_depth; END IF;

  -- 統合していないこと（merged_into_id が付いていない）
  IF EXISTS (SELECT 1 FROM public.ow_roles WHERE name='AIプロダクトマネージャー'
              AND (merged_into_id IS NOT NULL OR NOT is_active)) THEN
    RAISE EXCEPTION 'AIプロダクトマネージャーが統合・無効化されている。ロールバック';
  END IF;

  -- プロダクト配下の並び
  SELECT string_agg(r.name || '(' || r.display_order || ')', ' / ' ORDER BY r.display_order) INTO v_order
    FROM public.ow_roles r
   WHERE r.parent_id = (SELECT id FROM public.ow_roles WHERE name='プロダクト' AND parent_id IS NULL)
     AND r.is_active;
  RAISE NOTICE 'プロダクト配下: %', v_order;

  -- ② job_category のズレが0件
  SELECT count(*) INTO v_mismatch
    FROM public.ow_jobs j
    JOIN public.ow_job_roles jr ON jr.job_id = j.id AND jr.is_primary
    JOIN public.ow_roles r ON r.id = jr.role_id
   WHERE j.job_category IS DISTINCT FROM r.name;
  IF v_mismatch <> 0 THEN RAISE EXCEPTION 'job_category のズレが % 件残っている。ロールバック', v_mismatch; END IF;

  -- job_category が無効な職種名を指していないこと
  SELECT count(*) INTO v_invalid FROM public.ow_jobs j
    JOIN public.ow_roles r ON r.name = j.job_category WHERE NOT r.is_active;
  IF v_invalid <> 0 THEN RAISE EXCEPTION 'job_category が無効な職種名を指す求人が % 件。ロールバック', v_invalid; END IF;

  -- merge_role に再派生が入ったこと
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                  WHERE n.nspname='public' AND p.proname='merge_role'
                    AND p.prosrc LIKE '%job_category_resynced%') THEN
    RAISE EXCEPTION 'merge_role に job_category の再派生が入っていない。ロールバック';
  END IF;

  -- 職種を増減させていないこと
  SELECT count(*) INTO v_roles FROM public.ow_roles;
  IF v_roles <> 105 THEN RAISE EXCEPTION 'ow_roles が % 件（想定105）。ロールバック', v_roles; END IF;

  RAISE NOTICE '完了: AIプロダクトマネージャーを プロダクト 配下へ / job_category のズレ0件 / 3階層0件';
END $$;

COMMIT;
