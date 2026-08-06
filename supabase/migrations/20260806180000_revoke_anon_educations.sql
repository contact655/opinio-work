-- ═══════════════════════════════════════════════════════════════════════════
-- ow_user_educations を未ログインから読めなくする
--
-- ── なぜ（2026-08-06）──────────────────────────────────────────────────────
-- 未ログイン（anon）で学歴が 11件・6名分そのまま読めていた。実測済み。
-- 該当6名は**全員 ow_users.visibility = 'login_only'** で、本人の公開設定が効いていない。
--
-- 原因は2つの重なり:
--   ① GRANT ALL ON TABLE ow_user_educations TO anon（列も行も絞らない表レベル権限）
--   ② RLS ポリシー ow_user_educations_select_all が `FOR SELECT USING (true)`
--      — ow_users.visibility を一切見ていない
--
-- ⚠️ ①だけを落とす。②のポリシーは**今回は変えない**。
--    authenticated 側の扱いを次のステップでまとめて決めるので、
--    ここでポリシーを書き換えると2段階の変更がぶつかる。
--    ただし「意図とずれている」記録はここに残す:
--    USING (true) は「学歴は誰でも見てよい」と宣言しているに等しく、
--    ow_users.visibility とも /u/[id] の 404 判定とも整合していない。
--
-- ⚠️ authenticated は今回触らない。ログイン済みからは従来どおり読める。
--
-- ── アプリ側の読み取り経路（剥がす前に確認済み）────────────────────────────
--   createAdminClient（service_role。影響なし）
--     (jobseeker)/page.tsx:84 / schools/[id]/page.tsx:47 / mypage/page.tsx:148
--     lib/people/directory.ts:191 / u/[id]/page.tsx:198（この migration に合わせて admin へ移した）
--   ユーザーセッション（authenticated。今回は権限を触らないので影響なし）
--     mypage/page.tsx:58 / profile/edit/page.tsx:40 / api/jobseeker/educations/*
--   → anon クライアントで読んでいる箇所は 0 件。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_anon int; v_auth int; v_rows int;
BEGIN
  SELECT count(*) INTO v_anon FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ow_user_educations'
     AND grantee='anon' AND privilege_type='SELECT';
  IF v_anon = 0 THEN RAISE EXCEPTION 'anon に SELECT が無い。既に適用済み？中止'; END IF;

  SELECT count(*) INTO v_auth FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ow_user_educations'
     AND grantee='authenticated' AND privilege_type='SELECT';
  IF v_auth = 0 THEN RAISE EXCEPTION 'authenticated の SELECT が既に無い。想定外。中止'; END IF;

  SELECT count(*) INTO v_rows FROM public.ow_user_educations;
  RAISE NOTICE '適用前: 学歴 % 件 / anon SELECT あり / authenticated SELECT あり', v_rows;
END $$;

REVOKE SELECT ON TABLE public.ow_user_educations FROM anon;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_anon int; v_anon_col int; v_auth int; v_rows int; v_pol int;
BEGIN
  SELECT count(*) INTO v_anon FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ow_user_educations'
     AND grantee='anon' AND privilege_type='SELECT';
  IF v_anon <> 0 THEN RAISE EXCEPTION 'anon に表レベル SELECT が残っている。ロールバック'; END IF;

  -- 列単位で残っていないこと（表レベルを落としても列単位が残ると読める）
  SELECT count(*) INTO v_anon_col FROM information_schema.column_privileges
   WHERE table_schema='public' AND table_name='ow_user_educations'
     AND grantee='anon' AND privilege_type='SELECT';
  IF v_anon_col <> 0 THEN RAISE EXCEPTION 'anon に列単位 SELECT が % 列残っている。ロールバック', v_anon_col; END IF;

  -- authenticated は触っていないこと
  SELECT count(*) INTO v_auth FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ow_user_educations'
     AND grantee='authenticated' AND privilege_type='SELECT';
  IF v_auth = 0 THEN RAISE EXCEPTION 'authenticated の SELECT まで消えた。ロールバック'; END IF;

  -- 本人の編集経路（INSERT/UPDATE/DELETE）が残っていること
  IF (SELECT count(*) FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name='ow_user_educations' AND grantee='authenticated'
         AND privilege_type IN ('INSERT','UPDATE','DELETE')) <> 3 THEN
    RAISE EXCEPTION 'authenticated の INSERT/UPDATE/DELETE が欠けている。ロールバック';
  END IF;

  -- データは消していないこと
  SELECT count(*) INTO v_rows FROM public.ow_user_educations;
  IF v_rows <> 11 THEN RAISE EXCEPTION '学歴が % 件（想定11）。ロールバック', v_rows; END IF;

  -- ポリシーは触っていないこと（次のステップで扱う）
  SELECT count(*) INTO v_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_user_educations';
  IF v_pol <> 4 THEN RAISE EXCEPTION 'ポリシー数が % 本（想定4）。ロールバック', v_pol; END IF;

  RAISE NOTICE '完了: anon の SELECT を剥奪。authenticated と 学歴 % 件、ポリシー % 本は変更なし', v_rows, v_pol;
END $$;

COMMIT;
