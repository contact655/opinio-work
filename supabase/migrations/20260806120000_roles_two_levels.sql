-- ═══════════════════════════════════════════════════════════════════════════
-- 職種マスタを2階層に統一する
--
-- ── なぜ（2026-08-06 の実態調査）────────────────────────────────────────────
-- ow_roles は「親（大分類）→ 子（職種）」の2階層のつもりで作られているが、
-- 実データには3階層が2箇所あった。
--   プロダクト → デザイナー → プロダクトデザイナー ほか4件
--   営業      → ソリューションエンジニア・プリセールス → セールスエンジニア ほか4件
-- 入力UIは親→子の2段セレクトしかないため、**3階層目はUIから到達できない**。
-- それでも求人7件が孫に紐づいており（migration 投入とみられる）、
-- 画面から作れないデータが存在していた。
--
-- ⚠️ 物理削除はしない。不要になった職種は is_active=false + merged_into_id で論理削除する。
-- ⚠️ 手打ちUUID（a1b2c3d4-0000-...）は今回の問題の原因なので新規には使わない。
--    ここでは既存行の特定にだけ使い、新規行は作らない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_total int; v_gc int; v_designer uuid; v_sepre uuid;
BEGIN
  SELECT count(*) INTO v_total FROM public.ow_roles;
  IF v_total <> 98 THEN
    RAISE EXCEPTION 'ow_roles が % 行（想定98）。中止', v_total;
  END IF;

  -- 3階層の件数（この migration で 0 にする）
  SELECT count(*) INTO v_gc
    FROM public.ow_roles r
    JOIN public.ow_roles p ON p.id = r.parent_id
    JOIN public.ow_roles g ON g.id = p.parent_id;
  IF v_gc <> 10 THEN
    RAISE EXCEPTION '3階層が % 件（想定10）。中止', v_gc;
  END IF;

  SELECT id INTO v_designer FROM public.ow_roles WHERE slug = 'design';
  IF v_designer IS NULL THEN RAISE EXCEPTION 'slug=design が無い。中止'; END IF;

  SELECT id INTO v_sepre FROM public.ow_roles WHERE slug = 'sales-eng';
  IF v_sepre IS NULL THEN RAISE EXCEPTION 'slug=sales-eng が無い。中止'; END IF;

  RAISE NOTICE '適用前: ow_roles % 行 / 3階層 % 件', v_total, v_gc;
END $$;

-- ── 1-A. デザイナーを大分類に昇格 ───────────────────────────────────────────
-- level=1 なのに parent_id=プロダクト という矛盾を、本来の意図（大分類）に寄せて解消する。
-- 配下5件は parent_id=デザイナー のままでよく、これで自動的に2階層になる。
-- ⚠️ display_order は既存の大分類を後ろにずらして詰める。プロダクト(6)の直後に入れる。
UPDATE public.ow_roles SET display_order = display_order + 1
 WHERE parent_id IS NULL AND display_order >= 7 AND slug <> 'design';

UPDATE public.ow_roles
   SET parent_id = NULL, level = 1, display_order = 7
 WHERE slug = 'design';

-- ── 1-B. ソリューションエンジニア系の孫5件を親に集約 ────────────────────────
-- ⚠️ 順序が重要。参照を先に付け替えてから論理削除する。
--    先に is_active=false にすると、無効な職種を指す行が残る。
DO $$
DECLARE
  v_parent uuid;
  v_moved_jobs int; v_moved_jr int; v_dup int; v_alias int; v_deact int;
BEGIN
  SELECT id INTO v_parent FROM public.ow_roles WHERE slug = 'sales-eng';

  -- ① ow_jobs.role_category_id（単一カラムなので重複の概念なし）
  UPDATE public.ow_jobs j SET role_category_id = v_parent
   WHERE j.role_category_id IN (SELECT id FROM public.ow_roles WHERE parent_id = v_parent);
  GET DIAGNOSTICS v_moved_jobs = ROW_COUNT;

  -- ② ow_job_roles は PK (job_id, role_id)。付け替え先が既にある場合は付け替えられないので、
  --    先に重複になる行を落とす。⚠️ is_primary が立っている方を残す。
  WITH g AS (SELECT id FROM public.ow_roles WHERE parent_id = v_parent),
  dup AS (
    SELECT jr.job_id, jr.role_id
      FROM public.ow_job_roles jr
      JOIN g ON g.id = jr.role_id
     WHERE EXISTS (SELECT 1 FROM public.ow_job_roles x
                    WHERE x.job_id = jr.job_id AND x.role_id = v_parent)
       AND NOT jr.is_primary
  )
  DELETE FROM public.ow_job_roles t USING dup
   WHERE t.job_id = dup.job_id AND t.role_id = dup.role_id;
  GET DIAGNOSTICS v_dup = ROW_COUNT;

  -- 孫が is_primary で親が既にある場合は、親側を主に昇格させてから孫を落とす
  WITH g AS (SELECT id FROM public.ow_roles WHERE parent_id = v_parent),
  conflict AS (
    SELECT jr.job_id FROM public.ow_job_roles jr JOIN g ON g.id = jr.role_id
     WHERE jr.is_primary
       AND EXISTS (SELECT 1 FROM public.ow_job_roles x WHERE x.job_id = jr.job_id AND x.role_id = v_parent)
  )
  UPDATE public.ow_job_roles t SET is_primary = true
    FROM conflict WHERE t.job_id = conflict.job_id AND t.role_id = v_parent;

  WITH g AS (SELECT id FROM public.ow_roles WHERE parent_id = v_parent)
  DELETE FROM public.ow_job_roles t USING g
   WHERE t.role_id = g.id
     AND EXISTS (SELECT 1 FROM public.ow_job_roles x WHERE x.job_id = t.job_id AND x.role_id = v_parent);

  UPDATE public.ow_job_roles jr SET role_id = v_parent
   WHERE jr.role_id IN (SELECT id FROM public.ow_roles WHERE parent_id = v_parent);
  GET DIAGNOSTICS v_moved_jr = ROW_COUNT;

  -- ③ 残りの参照元（2026-08-06 実測ではいずれも0件だが、将来のために書いておく）
  UPDATE public.ow_experiences SET role_category_id = v_parent
   WHERE role_category_id IN (SELECT id FROM public.ow_roles WHERE parent_id = v_parent);

  DELETE FROM public.ow_experience_roles t
   WHERE t.role_id IN (SELECT id FROM public.ow_roles WHERE parent_id = v_parent)
     AND EXISTS (SELECT 1 FROM public.ow_experience_roles x
                  WHERE x.experience_id = t.experience_id AND x.role_id = v_parent);
  UPDATE public.ow_experience_roles SET role_id = v_parent
   WHERE role_id IN (SELECT id FROM public.ow_roles WHERE parent_id = v_parent);

  DELETE FROM public.ow_company_employee_categories t
   WHERE t.role_id IN (SELECT id FROM public.ow_roles WHERE parent_id = v_parent)
     AND EXISTS (SELECT 1 FROM public.ow_company_employee_categories x
                  WHERE x.company_id = t.company_id AND x.role_id = v_parent);
  UPDATE public.ow_company_employee_categories SET role_id = v_parent
   WHERE role_id IN (SELECT id FROM public.ow_roles WHERE parent_id = v_parent);
  UPDATE public.ow_company_employee_categories SET parent_role_id = v_parent
   WHERE parent_role_id IN (SELECT id FROM public.ow_roles WHERE parent_id = v_parent);

  UPDATE public.ow_salary_reports SET role_id = v_parent
   WHERE role_id IN (SELECT id FROM public.ow_roles WHERE parent_id = v_parent);

  UPDATE public.ow_placements SET current_role_id = v_parent
   WHERE current_role_id IN (SELECT id FROM public.ow_roles WHERE parent_id = v_parent);
  UPDATE public.ow_placements SET previous_role_id = v_parent
   WHERE previous_role_id IN (SELECT id FROM public.ow_roles WHERE parent_id = v_parent);

  UPDATE public.ow_company_job_roles SET standard_role_id = v_parent
   WHERE standard_role_id IN (SELECT id FROM public.ow_roles WHERE parent_id = v_parent);

  -- ④ 孫の名前を別名として残す。
  --    ⚠️「セールスエンジニア」「プリセールス」は既に親の別名にあるので入れない。
  --       UNIQUE (role_id, alias) があるため、NOT EXISTS で弾く。
  INSERT INTO public.ow_role_aliases (role_id, alias)
  SELECT v_parent, r.name
    FROM public.ow_roles r
   WHERE r.parent_id = v_parent
     AND NOT EXISTS (
       SELECT 1 FROM public.ow_role_aliases a
        WHERE a.role_id = v_parent AND a.alias = r.name
     );
  GET DIAGNOSTICS v_alias = ROW_COUNT;

  -- ⑤ 孫を論理削除する。
  --    ⚠️ is_active=false にするだけでは3階層のままなので、あわせて親を1つ上
  --       （＝ソリューションエンジニア・プリセールスの親＝営業）に付け替える。
  --       これで「営業 → 無効な子」という2階層に収まり、営業配下という系統も保てる。
  --       parent_id=NULL にすると大分類に昇格してしまうので採らない。
  UPDATE public.ow_roles
     SET is_active = false,
         merged_into_id = v_parent,
         parent_id = (SELECT parent_id FROM public.ow_roles WHERE id = v_parent),
         level = 2
   WHERE parent_id = v_parent;
  GET DIAGNOSTICS v_deact = ROW_COUNT;

  RAISE NOTICE '1-B: 求人 % 件 / job_roles % 件を親へ付け替え。重複削除 % 件 / 別名 % 件追加 / 孫 % 件を無効化',
    v_moved_jobs, v_moved_jr, v_dup, v_alias, v_deact;
END $$;

-- ── 1-C. level と parent_id の整合を取り直す ───────────────────────────────
-- ⚠️ level は parent_id から導出できる値であり、独立して持つ意味がない。
--    それでも残しているのは既存クエリ（biz/jobs の select）が読んでいるため。
--    ここで一度揃え、以後は下のトリガと合わせて破綻しないようにする。
UPDATE public.ow_roles SET level = 1 WHERE parent_id IS NULL     AND level IS DISTINCT FROM 1;
UPDATE public.ow_roles SET level = 2 WHERE parent_id IS NOT NULL AND level IS DISTINCT FROM 2;

-- ── 1-D. 3階層をDBで防ぐ ───────────────────────────────────────────────────
-- ⚠️ CHECK 制約では自己参照（親の親）を見られないのでトリガにする。
-- ⚠️ 既存データを直したあとに作ること。先に作ると 1-A / 1-B の UPDATE が弾かれる。
CREATE OR REPLACE FUNCTION public.ow_roles_enforce_two_levels()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_grandparent uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION '自分自身を親にはできない（role=%）', NEW.name;
  END IF;

  SELECT parent_id INTO v_grandparent FROM public.ow_roles WHERE id = NEW.parent_id;
  IF v_grandparent IS NOT NULL THEN
    RAISE EXCEPTION
      '職種は2階層まで。% は既に子である職種を親に指定している（親=%）', NEW.name, NEW.parent_id;
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.ow_roles_enforce_two_levels() IS
  '職種マスタを2階層に保つ。子である職種をさらに親に指定しようとすると例外。'
  ' 入力UI（/profile/edit と /biz の求人フォーム）が親→子の2段セレクトしか持たないため、'
  ' 3階層目はUIから到達できず、作ると「画面から作れないデータ」になる。';

DROP TRIGGER IF EXISTS trg_ow_roles_two_levels ON public.ow_roles;
CREATE TRIGGER trg_ow_roles_two_levels
  BEFORE INSERT OR UPDATE OF parent_id ON public.ow_roles
  FOR EACH ROW EXECUTE FUNCTION public.ow_roles_enforce_two_levels();

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_gc int; v_parents int; v_lvlnull int; v_refs int; v_fired boolean := false;
  v_parent uuid; v_child uuid;
BEGIN
  SELECT count(*) INTO v_gc
    FROM public.ow_roles r JOIN public.ow_roles p ON p.id=r.parent_id
    JOIN public.ow_roles g ON g.id=p.parent_id;
  IF v_gc <> 0 THEN RAISE EXCEPTION '3階層が % 件残っている。ロールバック', v_gc; END IF;

  SELECT count(*) INTO v_parents FROM public.ow_roles WHERE parent_id IS NULL;
  IF v_parents <> 10 THEN RAISE EXCEPTION '大分類が % 件（想定10）。ロールバック', v_parents; END IF;

  SELECT count(*) INTO v_lvlnull FROM public.ow_roles WHERE level IS NULL;
  IF v_lvlnull <> 0 THEN RAISE EXCEPTION 'level が NULL の行が % 件。ロールバック', v_lvlnull; END IF;

  -- 無効な職種を指している参照が無いこと
  SELECT
    (SELECT count(*) FROM public.ow_jobs j JOIN public.ow_roles r ON r.id=j.role_category_id WHERE NOT r.is_active)
  + (SELECT count(*) FROM public.ow_job_roles jr JOIN public.ow_roles r ON r.id=jr.role_id WHERE NOT r.is_active)
  + (SELECT count(*) FROM public.ow_experiences e JOIN public.ow_roles r ON r.id=e.role_category_id WHERE NOT r.is_active)
  + (SELECT count(*) FROM public.ow_experience_roles er JOIN public.ow_roles r ON r.id=er.role_id WHERE NOT r.is_active)
  + (SELECT count(*) FROM public.ow_salary_reports s JOIN public.ow_roles r ON r.id=s.role_id WHERE NOT r.is_active)
    INTO v_refs;
  IF v_refs <> 0 THEN RAISE EXCEPTION '無効な職種を指す参照が % 件。ロールバック', v_refs; END IF;

  -- トリガが効くこと（サブトランザクションなので必ず巻き戻る）
  SELECT id INTO v_parent FROM public.ow_roles WHERE parent_id IS NULL LIMIT 1;
  SELECT id INTO v_child  FROM public.ow_roles WHERE parent_id = v_parent LIMIT 1;
  IF v_child IS NOT NULL THEN
    BEGIN
      UPDATE public.ow_roles SET parent_id = v_child WHERE id = v_parent;
    EXCEPTION WHEN raise_exception THEN
      v_fired := true;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'トリガが効いていない。ロールバック'; END IF;
  END IF;

  RAISE NOTICE '完了: 3階層 0 件 / 大分類 % 件 / level NULL 0 件 / 無効職種への参照 0 件 / トリガ動作確認',
    v_parents;
END $$;

COMMIT;
