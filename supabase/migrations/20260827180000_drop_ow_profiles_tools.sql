-- ═══════════════════════════════════════════════════════════════════════════
-- 死列を落とす: ow_profiles.tools （2026-08-27）
--
-- ── なぜ落とすか ────────────────────────────────────────────────────────────
-- **同日に落とした `ow_profiles.skills` の双子。** どちらも
-- `archive/001_create_tables.sql`（最初のスキーマ）で隣り合って定義されていた:
--     transfer_timing TEXT,
--     skills TEXT[],
--     tools  TEXT[],     ← これ
--     bio TEXT,
-- 「プロフィールがスキルとツールを自由文字列の配列で持つ」という当時の設計の名残。
--
-- 実測（2026-08-27）: 非空 **0 / 52行**、src からの参照 **0件**。
-- ⚠️ src の `tools` は全部 `ow_company_tools` / `ow_tool_masters`（企業のツール）で、
--    この列とは無関係。混同しないこと。
--
-- ⚠️ **スキルの再導入ではこの列を使わない。** 標準スキルは `ow_skills` /
--    `ow_user_skills` の正規化テーブルで持つ（同日の後続 migration）。
--    text[] を残すと「どちらが正か」が分からなくなる。
--
-- ── 適用前に確認したこと（2026-08-27 実測。すべて 0件）────────────────────
--   関数本体 / ビュー定義 / RLS ポリシー式 / インデックス
--   ⚠️ 関数本体は Postgres が依存として追跡しないので `pg_get_functiondef` を
--      正規表現で検索した（CLAUDE.md「DROP するときのチェックリスト」）。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260827-1028-ow_profiles.sql（スキーマ+データ）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_rows int;
  v_dep  text;
  v_cols int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='ow_profiles' AND column_name='tools') THEN
    RAISE EXCEPTION 'ow_profiles.tools が存在しない。適用済みか、前提が違う。中止';
  END IF;

  -- ★中身が空であること。1行でも入っていたら落とさない
  SELECT count(*) INTO v_rows FROM public.ow_profiles
   WHERE tools IS NOT NULL AND array_length(tools, 1) > 0;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'ow_profiles.tools が空ではない（% 行）。中止', v_rows;
  END IF;

  SELECT string_agg(viewname, ', ') INTO v_dep FROM pg_views
   WHERE schemaname='public' AND definition ~ '\mtools\M';
  IF v_dep IS NOT NULL THEN RAISE EXCEPTION 'ビューが参照している: %。中止', v_dep; END IF;

  SELECT string_agg(c.relname||'.'||p.polname, ', ') INTO v_dep
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relnamespace='public'::regnamespace
     AND (coalesce(pg_get_expr(p.polqual, p.polrelid), '')      ~ '\mtools\M'
       OR coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ '\mtools\M');
  IF v_dep IS NOT NULL THEN RAISE EXCEPTION 'RLS ポリシーが参照している: %。中止', v_dep; END IF;

  SELECT string_agg(indexname, ', ') INTO v_dep FROM pg_indexes
   WHERE schemaname='public' AND tablename='ow_profiles' AND indexdef ~ '\mtools\M';
  IF v_dep IS NOT NULL THEN RAISE EXCEPTION 'インデックスが参照している: %。中止', v_dep; END IF;

  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_profiles';
  RAISE NOTICE '適用前: ow_profiles % 列（27 が想定）', v_cols;
END $$;

-- ⚠️ CASCADE は使わない（依存物を黙って道連れにしないため）
ALTER TABLE public.ow_profiles DROP COLUMN tools;

DO $$
DECLARE
  v_cols int;
  v_missing text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='ow_profiles' AND column_name='tools') THEN
    RAISE EXCEPTION 'ow_profiles.tools が残っている。中止';
  END IF;

  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_profiles';
  IF v_cols <> 26 THEN RAISE EXCEPTION 'ow_profiles が % 列（26 のはず）。他の列を巻き込んだ。中止', v_cols; END IF;

  -- ★列数だけでは入れ替わりを検出できないので、主要な列を名前で確認する
  SELECT string_agg(c, ', ') INTO v_missing FROM unnest(ARRAY[
    'user_id','onboarding_completed','career_stance','scout_enabled',
    'desired_salary_min','desired_salary_max','transfer_timing','email_weekly_enabled'
  ]) c
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema='public' AND table_name='ow_profiles' AND column_name=c);
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'ow_profiles から列が消えている: %。中止', v_missing; END IF;

  RAISE NOTICE '完了: ow_profiles % 列', v_cols;
END $$;

COMMIT;
