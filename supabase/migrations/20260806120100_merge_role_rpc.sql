-- ═══════════════════════════════════════════════════════════════════════════
-- merge_role(from_role_id, to_role_id) — 職種の統合を参照の付け替え込みで行う
--
-- ── なぜ（2026-08-06）──────────────────────────────────────────────────────
-- これまでの統合（PATCH /api/admin/roles の action="merge"）は
--   update ow_roles set merged_into_id = ..., is_active = false
-- を実行するだけで、**参照はまったく触っていなかった**。
-- 統合された職種を指したままの ow_experiences / ow_jobs / ow_job_roles が残り、
-- 求職者側には「無効な職種」がそのまま表示され続ける。
-- 現状で実害が出ていないのは、既に統合済みの1件（セールスエンジニア・プリセールス）が
-- たまたま参照0件だったため。
--
-- ⚠️ トランザクションで一括にすること。付け替えの途中で失敗すると、
--    一部だけ移った状態になり、どこまで進んだか後から分からなくなる。
-- ⚠️ 物理削除はしない。from は is_active=false + merged_into_id を立てるだけ。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.merge_role(from_role_id uuid, to_role_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from record;
  v_to   record;
  v_children int;
  v_jobs int; v_job_roles int; v_exp int; v_exp_roles int;
  v_cats int; v_salary int; v_placements int; v_cjr int; v_alias int;
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

  UPDATE ow_salary_reports SET role_id = to_role_id WHERE role_id = from_role_id;
  GET DIAGNOSTICS v_salary = ROW_COUNT;

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
    'employee_categories', v_cats, 'salary_reports', v_salary,
    'placements', v_placements, 'company_job_roles', v_cjr,
    'aliases_added', v_alias
  );
END $$;

COMMENT ON FUNCTION public.merge_role(uuid, uuid) IS
  '職種の統合。参照の付け替え・別名の引き継ぎ・論理削除をトランザクションで行う。'
  ' ⚠️ ow_roles を参照するテーブルを足したら、この関数の②にも足すこと。'
  ' 漏れると統合後に無効な職種を指す行が残る（2026-08-06 まで参照を一切触っていなかった）。';

-- ⚠️ 実行できるのは service_role だけにする。API 側で admin 判定を通したうえで呼ぶ。
REVOKE ALL ON FUNCTION public.merge_role(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_role(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_role(uuid, uuid) TO service_role;

-- ── 事後チェック ────────────────────────────────────────────────────────────
-- ⚠️ サブトランザクションで実際に統合を試し、必ず巻き戻す。データは変わらない。
DO $$
DECLARE
  v_from uuid; v_to uuid; v_child_parent uuid; v_fired boolean := false; v_res jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'merge_role') THEN
    RAISE EXCEPTION 'merge_role が作られていない。ロールバック';
  END IF;

  -- 子を持つ職種は弾かれること
  SELECT id INTO v_child_parent FROM ow_roles WHERE parent_id IS NULL LIMIT 1;
  SELECT id INTO v_to FROM ow_roles WHERE parent_id IS NULL AND id <> v_child_parent LIMIT 1;
  BEGIN
    PERFORM merge_role(v_child_parent, v_to);
  EXCEPTION WHEN raise_exception THEN
    v_fired := true;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION '子を持つ職種の統合が弾かれない。ロールバック'; END IF;

  -- 参照を持つ職種の統合が通り、付け替え件数が返ること
  v_fired := false;
  SELECT id INTO v_from FROM ow_roles WHERE slug = 'enterprise-sales';
  SELECT id INTO v_to   FROM ow_roles WHERE slug = 'ae';
  IF v_from IS NOT NULL AND v_to IS NOT NULL THEN
    BEGIN
      SELECT merge_role(v_from, v_to) INTO v_res;
      RAISE NOTICE '検証: %', v_res;
      RAISE EXCEPTION 'rollback_marker';   -- ここで必ず巻き戻す
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'rollback_marker' THEN RAISE; END IF;
      v_fired := true;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION '検証が巻き戻っていない。ロールバック'; END IF;
  END IF;

  RAISE NOTICE '完了: merge_role を作成。子ありは拒否、参照ありは付け替えできることを確認（検証は巻き戻し済み）';
END $$;

COMMIT;
