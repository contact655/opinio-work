-- ═══════════════════════════════════════════════════════════════════════════
-- 死列を落とす: ow_profiles.skills / ow_users.mentor_themes （2026-08-27）
--
-- ── なぜ落とすか ────────────────────────────────────────────────────────────
-- どちらも 2026-08-03 の「スキルタグ・資格・話せるテーマの廃止」
-- （20260803183534）で**読み手だけが消され、列は残った**もの。
-- 実測（2026-08-27）:
--   ow_profiles.skills        非空 0 / 52行   src からの参照 0件
--   ow_users.mentor_themes    非空 0 / 38行   src は types.ts（自動生成）のみ
--
-- ★`ow_profiles.skills` は **anon の SELECT が通っている**（実測）。
--   中身は空だが、読める列を残しておく理由が無い。塞ぐ意味もあって落とす。
--
-- ⚠️ **スキルは再導入する予定がある**（docs/phase0-skills-20260827.md）。
--    ただし3層（標準スキル / 自由入力 / 昇格）を持つ正規化テーブルになるので、
--    **この text[] を流用しない。** 残しておくと「どちらが正か」が分からなくなる。
--
-- ── 適用前に確認したこと（2026-08-27 実測。すべて 0件）────────────────────
--   FK 参照 / 関数本体 / ビュー定義 / RLS ポリシー式 / トリガー関数 /
--   インデックス / 生成列・デフォルト
--   ⚠️ 関数本体は Postgres が依存として追跡しないので `pg_get_functiondef` を
--      正規表現で検索した（CLAUDE.md「DROP するときのチェックリスト」）。
--   ⚠️ 下の DO ブロックで**適用時点にも同じ検査をやり直す**。静的に見ただけでは
--      適用のタイミングでの保証にならない。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260827-0321-ow_profiles-ow_users.sql
--   （スキーマ+データ。両列の定義 `skills text[]` / `mentor_themes text[]` を含む）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── ① 前提の確認 ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_skills_rows  int;
  v_themes_rows  int;
  v_dep          text;
  v_cols_p       int;
  v_cols_u       int;
BEGIN
  -- 列が存在すること（既に落ちていたら中止。二重適用を成功に見せない）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='ow_profiles' AND column_name='skills') THEN
    RAISE EXCEPTION 'ow_profiles.skills が存在しない。適用済みか、前提が違う。中止';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='ow_users' AND column_name='mentor_themes') THEN
    RAISE EXCEPTION 'ow_users.mentor_themes が存在しない。適用済みか、前提が違う。中止';
  END IF;

  -- ★中身が空であること。**1行でも入っていたら落とさない**
  SELECT count(*) INTO v_skills_rows FROM public.ow_profiles
   WHERE skills IS NOT NULL AND array_length(skills, 1) > 0;
  SELECT count(*) INTO v_themes_rows FROM public.ow_users
   WHERE mentor_themes IS NOT NULL AND array_length(mentor_themes, 1) > 0;
  IF v_skills_rows <> 0 OR v_themes_rows <> 0 THEN
    RAISE EXCEPTION '空ではない（skills % 行 / mentor_themes % 行）。中止', v_skills_rows, v_themes_rows;
  END IF;

  -- 関数・ビュー・ポリシー・トリガーからの参照が無いこと
  SELECT string_agg(proname, ', ') INTO v_dep FROM pg_proc
   WHERE pronamespace='public'::regnamespace
     AND pg_get_functiondef(oid) ~ '\m(mentor_themes)\M';
  IF v_dep IS NOT NULL THEN RAISE EXCEPTION '関数が mentor_themes を参照している: %。中止', v_dep; END IF;

  SELECT string_agg(viewname, ', ') INTO v_dep FROM pg_views
   WHERE schemaname='public' AND (definition ~ '\mskills\M' OR definition ~ '\mmentor_themes\M');
  IF v_dep IS NOT NULL THEN RAISE EXCEPTION 'ビューが参照している: %。中止', v_dep; END IF;

  SELECT string_agg(c.relname||'.'||p.polname, ', ') INTO v_dep
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relnamespace='public'::regnamespace
     AND (coalesce(pg_get_expr(p.polqual, p.polrelid), '')      ~ '\m(skills|mentor_themes)\M'
       OR coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ '\m(skills|mentor_themes)\M');
  IF v_dep IS NOT NULL THEN RAISE EXCEPTION 'RLS ポリシーが参照している: %。中止', v_dep; END IF;

  SELECT string_agg(DISTINCT t.tgname, ', ') INTO v_dep
    FROM pg_trigger t JOIN pg_proc pr ON pr.oid = t.tgfoid
   WHERE NOT t.tgisinternal AND pg_get_functiondef(pr.oid) ~ '\m(skills|mentor_themes)\M';
  IF v_dep IS NOT NULL THEN RAISE EXCEPTION 'トリガーが参照している: %。中止', v_dep; END IF;

  -- 適用前の列数（事後に他の列が巻き添えになっていないか比べる）
  SELECT count(*) INTO v_cols_p FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_profiles';
  SELECT count(*) INTO v_cols_u FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_users';
  RAISE NOTICE '適用前: ow_profiles % 列 / ow_users % 列（28 / 33 が想定）', v_cols_p, v_cols_u;
END $$;

-- ── ② 落とす ───────────────────────────────────────────────────────────────
-- ⚠️ CASCADE は使わない。依存物を黙って道連れにするので、想定外の依存が
--    あったときに気づけない。既定の RESTRICT のまま落とし、依存があれば止める。
ALTER TABLE public.ow_profiles DROP COLUMN skills;
ALTER TABLE public.ow_users    DROP COLUMN mentor_themes;

-- ── ③ 事後の検証。★「エラーが出なかった」を成功にしない ────────────────────
DO $$
DECLARE
  v_cols_p int;
  v_cols_u int;
  v_missing text;
BEGIN
  -- 落としたい列が消えていること
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='ow_profiles' AND column_name='skills') THEN
    RAISE EXCEPTION 'ow_profiles.skills が残っている。中止';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='ow_users' AND column_name='mentor_themes') THEN
    RAISE EXCEPTION 'ow_users.mentor_themes が残っている。中止';
  END IF;

  -- ★他の列が巻き添えになっていないこと（28-1=27 / 33-1=32）
  SELECT count(*) INTO v_cols_p FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_profiles';
  SELECT count(*) INTO v_cols_u FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_users';
  IF v_cols_p <> 27 THEN RAISE EXCEPTION 'ow_profiles が % 列（27 のはず）。他の列を巻き込んだ。中止', v_cols_p; END IF;
  IF v_cols_u <> 32 THEN RAISE EXCEPTION 'ow_users が % 列（32 のはず）。他の列を巻き込んだ。中止', v_cols_u; END IF;

  -- ★アプリが実際に読む主要な列が残っていること（列数だけでは入れ替わりを検出できない）
  SELECT string_agg(c, ', ') INTO v_missing FROM unnest(ARRAY[
    'user_id','onboarding_completed','career_stance','scout_enabled','desired_salary_min','tools'
  ]) c
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema='public' AND table_name='ow_profiles' AND column_name=c);
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'ow_profiles から列が消えている: %。中止', v_missing; END IF;

  SELECT string_agg(c, ', ') INTO v_missing FROM unnest(ARRAY[
    'id','auth_id','name','email','visibility','is_test','is_system','avatar_url','headline','about_me'
  ]) c
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema='public' AND table_name='ow_users' AND column_name=c);
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'ow_users から列が消えている: %。中止', v_missing; END IF;

  RAISE NOTICE '完了: ow_profiles % 列 / ow_users % 列', v_cols_p, v_cols_u;
END $$;

COMMIT;
