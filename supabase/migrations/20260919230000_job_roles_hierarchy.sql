-- ═══════════════════════════════════════════════════════════════════════════
-- ow_company_job_roles を階層にする（2026-09-19 / 柴さんの指示）
--
-- **部門と同じように、自社職種も入れ子にできるようにする。**
-- 人事担当者は「部門から作る人」と「職種から作る人」の両方がいるため、
-- どちらから始めても同じ形で組織を作れるようにする。
--
-- ── 変えるもの ───────────────────────────────────────────────────────────
--   ① parent_id を足す（自己参照 / ON DELETE CASCADE。**部門と同じ形**）
--   ② UNIQUE (company_id, name) → (company_id, name, parent_id) に張り替える
--
-- ⚠️★②が要る理由: 階層にすると**別の親の下に同じ名前**が普通に出てくる
--    （営業 > マネージャー と カスタマーサクセス > マネージャー）。
--    いまの制約のままだと2つ目が 23505 で弾かれ、**作れない木ができる。**
--    ⚠️ 部門は最初から `(company_id, name, parent_id)`。**そちらに合わせただけ**で、
--       新しい形を作ったわけではない。
--
-- ⚠️ Postgres の UNIQUE は既定で **NULL どうしを別物として扱う**ので、
--    `parent_id IS NULL`（＝最上位）の同名は**2つ作れる**。
--    ⚠️★**これは部門も同じ**（`ow_company_departments` の既存の制約がそうなっている）。
--       直すなら `NULLS NOT DISTINCT` だが、**部門と職種を同時に変える判断が要る**ので
--       ここではやらない。**片方だけ変えて挙動を割らないこと。**
--
-- ── 階層の深さ（5階層まで）について ──────────────────────────────────────
-- ⚠️★**DB では縛っていない。UI と API の2層で担保する。**
--    深さは CHECK では書けず、書くならトリガーになる。CLAUDE.md の
--    「3層に揃えるのは『値の集合』の制約。件数・深さのような濃度は UI と API の2層」
--    に従う。破られても壊れるものが無く（深い木が1本できるだけ）、
--    トリガーは後から読む人が気づけない挙動になるため。
--
-- ⚠️ 追加のみ（列の追加と制約の張り替え）。既存1行は parent_id が NULL で最上位になる。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.ow_company_job_roles
  ADD COLUMN IF NOT EXISTS parent_id uuid
    REFERENCES public.ow_company_job_roles(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.ow_company_job_roles.parent_id IS
  '親の自社職種。NULL は最上位。部門（ow_company_departments.parent_id）と同じ形。'
  '⚠️ 深さの上限（5階層）は DB では縛っていない。UI と API で担保する。';

-- ⚠️ 制約名は Postgres の既定の付け方に合わせる（列の並び順どおり）。
ALTER TABLE public.ow_company_job_roles
  DROP CONSTRAINT IF EXISTS ow_company_job_roles_company_id_name_key;

ALTER TABLE public.ow_company_job_roles
  ADD CONSTRAINT ow_company_job_roles_company_id_name_parent_id_key
    UNIQUE (company_id, name, parent_id);

-- ⚠️ 親で引く（木を組むとき・子を消すとき）ので索引を1本。
--    ⚠️ CLAUDE.md「FK にインデックスを足すな」は**行数の多い表を前提にした advisor の
--       一般則への反論**で、ここは木を辿る実際の読みがある。とはいえ現在1行なので
--       効き目は将来のもの。**他のFKに横展開しないこと。**
CREATE INDEX IF NOT EXISTS ow_company_job_roles_parent_id_idx
  ON public.ow_company_job_roles (parent_id);

DO $$
DECLARE v_col boolean; v_old int; v_new int; v_trg int;
BEGIN
  SELECT count(*)=1 INTO v_col FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_company_job_roles' AND column_name='parent_id';
  IF NOT v_col THEN RAISE EXCEPTION 'parent_id が足されていない。中止'; END IF;

  SELECT count(*) INTO v_old FROM pg_constraint
   WHERE conrelid='public.ow_company_job_roles'::regclass
     AND conname='ow_company_job_roles_company_id_name_key';
  IF v_old <> 0 THEN RAISE EXCEPTION '旧 UNIQUE が残っている。中止'; END IF;

  SELECT count(*) INTO v_new FROM pg_constraint
   WHERE conrelid='public.ow_company_job_roles'::regclass
     AND conname='ow_company_job_roles_company_id_name_parent_id_key';
  IF v_new <> 1 THEN RAISE EXCEPTION '新 UNIQUE が張れていない。中止'; END IF;

  -- ⚠️ この表に trigger を増やしていないこと（深さはアプリで担保する判断）
  SELECT count(*) INTO v_trg FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   WHERE c.relname='ow_company_job_roles' AND NOT t.tgisinternal;
  IF v_trg <> 0 THEN RAISE EXCEPTION 'trigger が % 本ある（想定0）。中止', v_trg; END IF;

  RAISE NOTICE '適用後: parent_id 追加 / UNIQUE を (company_id, name, parent_id) に張り替え / trigger 0本';
END $$;

COMMIT;
