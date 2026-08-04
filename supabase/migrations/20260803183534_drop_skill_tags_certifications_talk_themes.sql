-- ═══════════════════════════════════════════════════════════════════════════
-- スキルタグ・資格・話せるテーマの廃止（データ側）
--
--   DROP TABLE  ow_user_skill_tags        （32行）
--   DROP TABLE  ow_user_certifications    （10行）
--   DROP COLUMN ow_company_members.talk_themes  （5行中 非空2）
--   DROP COLUMN ow_company_admins.talk_themes   （10行中 非空0）
--
-- ── コード側の参照が消えていること（2026-08-04 確認）──────────────────────
-- UI・API・型の削除は dbcce9c8 で完了し、本番に反映済み。
-- 確認方法と結果:
--
--   $ grep -rn "ow_user_skill_tags\|ow_user_certifications\|skill-tags\|SkillTag\|\
--       talk_themes\|talkThemes\|TalkThemes" src/
--   → src/lib/supabase/types.ts（自動生成）と
--     src/app/(jobseeker)/people/PeopleListClient.tsx のコメント2行以外は 0件
--
--   $ npx tsc --noEmit / npx eslint src/   → いずれもエラーなし
--
-- 削除したもの:
--   API      /api/jobseeker/skill-tags[/[id]] と /api/jobseeker/certifications[/[id]]
--   入力UI   /profile/edit のスキルタブ・資格エディタ、/admin/biz-accounts の
--            TalkThemesEditor、/api/biz/ambassador/update の talk_themes 受け口
--   表示     /u/[id] のスキル・資格セクション、UserProfileCard のスキル・資格、
--            /people のカード、/companies/[id] のアンバサダー、/biz/members
--   計算     /jobs のマッチングスコア（SKILL 20点を削除し4軸に比例配分）、
--            プロフィール完成度（スキル15点を職歴に移動）
--   判定軸   「面談可」バッジ talk_themes の件数 → ow_users.can_casual_meeting
--
-- ⚠️ 適用後は `npm run gen:types` を実行して types.ts を更新すること。
--    型定義が実態とズレると、存在しない列を参照するバグがエラーを出さずに埋もれる
--    （CLAUDE.md「型の同期」参照）。
--
-- ── FK と依存の扱い ─────────────────────────────────────────────────────────
-- 2つのテーブルが持つ FK は user_id → ow_users のみ（ON DELETE CASCADE）で、
-- どちらも「参照する側」。**このテーブルを参照する側の FK は無い**。
-- ただし静的に確認しただけでは適用時点の保証にならないため、
-- 下の DO ブロックで pg_constraint / pg_depend から動的に検査する。
--
-- ⚠️ DROP TABLE ... CASCADE は使わない。CASCADE は依存物を黙って道連れにするので、
--    想定外の依存があったときに気づけない。既定の RESTRICT のまま落とし、
--    依存があればエラーで止める。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_skill_rows int;
  v_cert_rows  int;
  v_themes_m   int;
  v_themes_a   int;
  v_inbound_fk int;
  v_dep        text;
  v_view       text;
  v_proc       text;
BEGIN
  -- ── ① テーブルと列が存在すること ────────────────────────────────────────
  IF to_regclass('public.ow_user_skill_tags') IS NULL
     OR to_regclass('public.ow_user_certifications') IS NULL THEN
    RAISE EXCEPTION '対象テーブルが見つからない。適用済みの可能性。中止';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ow_company_members' AND column_name='talk_themes'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ow_company_admins' AND column_name='talk_themes'
  ) THEN
    RAISE EXCEPTION 'talk_themes 列が見つからない。適用済みの可能性。中止';
  END IF;

  -- ── ② 行数が想定どおりであること ────────────────────────────────────────
  --    入力UI は本番から消えているので新規行は増えないはず。
  --    増えていれば「消したはずの経路がまだ生きている」ことになるので中止する。
  SELECT count(*) INTO v_skill_rows FROM ow_user_skill_tags;
  SELECT count(*) INTO v_cert_rows  FROM ow_user_certifications;
  SELECT count(*) INTO v_themes_m FROM ow_company_members WHERE COALESCE(array_length(talk_themes,1),0) > 0;
  SELECT count(*) INTO v_themes_a FROM ow_company_admins  WHERE COALESCE(array_length(talk_themes,1),0) > 0;

  IF v_skill_rows <> 32 THEN
    RAISE EXCEPTION 'ow_user_skill_tags が % 行（想定32行）。入力経路が残っている可能性。中止', v_skill_rows;
  END IF;
  IF v_cert_rows <> 10 THEN
    RAISE EXCEPTION 'ow_user_certifications が % 行（想定10行）。中止', v_cert_rows;
  END IF;
  IF v_themes_m <> 2 THEN
    RAISE EXCEPTION 'ow_company_members.talk_themes の非空が % 行（想定2行）。中止', v_themes_m;
  END IF;
  IF v_themes_a <> 0 THEN
    RAISE EXCEPTION 'ow_company_admins.talk_themes の非空が % 行（想定0行）。中止', v_themes_a;
  END IF;

  RAISE NOTICE '削除対象: skill_tags % 行 / certifications % 行 / talk_themes 非空 %+% 行',
    v_skill_rows, v_cert_rows, v_themes_m, v_themes_a;

  -- ── ③ 被参照 FK が無いこと（CASCADE で巻き込まないための事前確認）────────
  --    ow_users の削除で学んだとおり、FK があっても DELETE/DROP は
  --    エラーで止まらず黙って巻き込む。落とす前に必ず数える。
  SELECT count(*) INTO v_inbound_fk
    FROM pg_constraint
   WHERE contype = 'f'
     AND confrelid IN ('public.ow_user_skill_tags'::regclass,
                       'public.ow_user_certifications'::regclass);

  IF v_inbound_fk > 0 THEN
    RAISE EXCEPTION
      '削除対象テーブルを参照する FK が % 件ある。CASCADE で巻き込む前に中止', v_inbound_fk;
  END IF;

  -- ── ④ ビュー・関数からの参照が無いこと ──────────────────────────────────
  SELECT string_agg(viewname, ', ') INTO v_view
    FROM pg_views
   WHERE schemaname = 'public'
     AND (definition ILIKE '%ow_user_skill_tags%'
       OR definition ILIKE '%ow_user_certifications%'
       OR definition ILIKE '%talk_themes%');
  IF v_view IS NOT NULL THEN
    RAISE EXCEPTION 'ビューが参照している: %。中止', v_view;
  END IF;

  SELECT string_agg(p.proname, ', ') INTO v_proc
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND (p.prosrc ILIKE '%ow_user_skill_tags%'
       OR p.prosrc ILIKE '%ow_user_certifications%'
       OR p.prosrc ILIKE '%talk_themes%');
  IF v_proc IS NOT NULL THEN
    RAISE EXCEPTION '関数が参照している: %。中止', v_proc;
  END IF;

  -- ── ⑤ talk_themes 列に他の依存物（index / 制約 / 生成列）が無いこと ──────
  --    ここが引っかかると DROP COLUMN が失敗するので、先に名前を出して止める。
  SELECT string_agg(DISTINCT c.relname, ', ') INTO v_dep
    FROM pg_attribute a
    JOIN pg_class t ON t.oid = a.attrelid
    JOIN pg_depend d ON d.refobjid = a.attrelid AND d.refobjsubid = a.attnum
    JOIN pg_class c ON c.oid = d.objid
   WHERE t.relname IN ('ow_company_members','ow_company_admins')
     AND a.attname = 'talk_themes'
     AND c.relkind IN ('i','v','m');
  IF v_dep IS NOT NULL THEN
    RAISE EXCEPTION 'talk_themes 列に依存する index/view がある: %。中止', v_dep;
  END IF;
END $$;

-- ── ⑥ 適用 ────────────────────────────────────────────────────────────────
--    CASCADE は付けない（依存があれば落ちてほしい）。
--    RLS ポリシー・インデックス・CHECK 制約はテーブルと一緒に消える。
DROP TABLE public.ow_user_skill_tags;
DROP TABLE public.ow_user_certifications;

ALTER TABLE public.ow_company_members DROP COLUMN talk_themes;
ALTER TABLE public.ow_company_admins  DROP COLUMN talk_themes;

-- ── ⑦ 事後チェック ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.ow_user_skill_tags') IS NOT NULL
     OR to_regclass('public.ow_user_certifications') IS NOT NULL THEN
    RAISE EXCEPTION 'テーブルが残っている。ロールバック';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND column_name='talk_themes'
       AND table_name IN ('ow_company_members','ow_company_admins')
  ) THEN
    RAISE EXCEPTION 'talk_themes 列が残っている。ロールバック';
  END IF;

  -- 巻き込み事故が無いこと。廃止と無関係のテーブルの行数を確認する。
  IF (SELECT count(*) FROM ow_company_members) <> 5 THEN
    RAISE EXCEPTION 'ow_company_members の行数が変わった。ロールバック';
  END IF;
  IF (SELECT count(*) FROM ow_company_admins) <> 10 THEN
    RAISE EXCEPTION 'ow_company_admins の行数が変わった。ロールバック';
  END IF;
  IF (SELECT count(*) FROM ow_users) <> 26 THEN
    RAISE EXCEPTION 'ow_users の行数が変わった。ロールバック';
  END IF;

  RAISE NOTICE '完了: 2テーブルを DROP、talk_themes 列を2つ削除した';
END $$;

COMMIT;
