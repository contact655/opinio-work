-- ═══════════════════════════════════════════════════════════════════════════
-- public の既定ACLから authenticated も落とす（これから作るオブジェクトだけ）
--
-- ── なぜ（2026-08-07）──────────────────────────────────────────────────────
-- 20260807050000 で anon を落としたが、**authenticated には同じ穴が残っていた**。
-- ow_profile_desired_roles を作ったとき、anon と同時に authenticated にも
-- arwdDxtm（8種）が自動で付いていた。明示的に4種へ絞ったのは
-- 「anon が危ない」と分かっていて REVOKE を書いたからで、
-- 書き忘れれば authenticated は **TRUNCATE / TRIGGER / REFERENCES まで持つ**。
-- ログイン済みなら誰でも新テーブルを空にできる状態になる。
--
-- ── 「明示が必要になる」のは利点 ────────────────────────────────────────────
-- 既定を落とすと、新テーブルごとに GRANT を1行書く必要が出る。これは手間ではなく、
-- **権限設計が migration に必ず残る**ということ。
-- 今は「書いていない = 全権限」で、migration を読んでも権限が分からない。
--
-- ⚠️ 失敗の出方は静かではない。権限が無ければ PostgREST は
--    `401 permission denied for table` を返してはっきり落ちる。
--    「黙って空になる」形にはならない。
--
-- ⚠️ **既存オブジェクトの権限は1件も変えない。** 既定ACLは
--    「これから作られるもの」にしか効かない。
-- ⚠️ 対象ロールは postgres（20260807050000 で確定済み）。supabase_admin は触らない。
-- ⚠️ service_role は残す。admin クライアントが RLS をバイパスして使う。
--
-- ── 今後テーブルを作るときに必要になる行 ────────────────────────────────────
--   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<新テーブル> TO authenticated;
--   GRANT ALL ON TABLE public.<新テーブル> TO service_role;
--   -- anon に読ませる公開テーブルなら明示的に
--   GRANT SELECT ON TABLE public.<新テーブル> TO anon;
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_acl text; v_grants int; v_anon int; v_auth int; v_tables int; r record;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'この migration は postgres で流す前提（現在 %）。中止', current_user;
  END IF;

  -- 前段（anon 除去）が入っていること
  FOR r IN SELECT unnest(ARRAY['r','S','f']) AS t LOOP
    SELECT defaclacl::text INTO v_acl FROM pg_default_acl
     WHERE defaclnamespace='public'::regnamespace
       AND defaclrole='postgres'::regrole AND defaclobjtype=r.t;
    IF v_acl IS NULL THEN RAISE EXCEPTION '既定ACL(%) の行が無い。中止', r.t; END IF;
    IF v_acl LIKE '%anon=%' THEN
      RAISE EXCEPTION '既定ACL(%) にまだ anon がいる。20260807050000 が未適用。中止: %', r.t, v_acl;
    END IF;
    IF v_acl NOT LIKE '%authenticated=%' THEN
      RAISE EXCEPTION '既定ACL(%) に authenticated が無い。既に適用済み？中止: %', r.t, v_acl;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_grants FROM information_schema.role_table_grants WHERE table_schema='public';
  SELECT count(*) INTO v_anon   FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='anon';
  SELECT count(*) INTO v_auth   FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='authenticated';
  SELECT count(*) INTO v_tables FROM information_schema.tables WHERE table_schema='public';

  IF v_grants <> 3651 THEN RAISE EXCEPTION '既存の表権限が % 件（想定3651）。中止', v_grants; END IF;
  IF v_anon   <> 696  THEN RAISE EXCEPTION 'anon の表権限が % 件（想定696）。中止', v_anon; END IF;
  IF v_auth   <> 981  THEN RAISE EXCEPTION 'authenticated の表権限が % 件（想定981）。中止', v_auth; END IF;
  IF v_tables <> 141  THEN RAISE EXCEPTION 'テーブルが % 件（想定141）。中止', v_tables; END IF;

  RAISE NOTICE '適用前: 既存の表権限 % 件（anon % / authenticated %）/ テーブル % 件',
    v_grants, v_anon, v_auth, v_tables;
END $$;

-- ── 既定ACLから authenticated を落とす ─────────────────────────────────────
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_acl text; v_grants int; v_anon int; v_auth int; v_tables int;
  v_p_anon int; v_p_auth int; v_p_svc int; r record;
BEGIN
  -- ① 既定ACL: anon / authenticated が消え、service_role が残っていること
  FOR r IN SELECT unnest(ARRAY['r','S','f']) AS t LOOP
    SELECT defaclacl::text INTO v_acl FROM pg_default_acl
     WHERE defaclnamespace='public'::regnamespace
       AND defaclrole='postgres'::regrole AND defaclobjtype=r.t;
    IF v_acl IS NULL THEN RAISE EXCEPTION '既定ACL(%) の行ごと消えた。ロールバック', r.t; END IF;
    IF v_acl LIKE '%anon=%' THEN RAISE EXCEPTION '既定ACL(%) に anon が復活: %。ロールバック', r.t, v_acl; END IF;
    IF v_acl LIKE '%authenticated=%' THEN
      RAISE EXCEPTION '既定ACL(%) にまだ authenticated がいる: %。ロールバック', r.t, v_acl;
    END IF;
    IF v_acl NOT LIKE '%service_role=%' THEN
      RAISE EXCEPTION '既定ACL(%) から service_role まで消えた: %。ロールバック', r.t, v_acl;
    END IF;
    RAISE NOTICE '適用後 既定ACL(%) = %', r.t, v_acl;
  END LOOP;

  -- ② 実測: プローブ用テーブルで anon も authenticated も権限0件になること
  EXECUTE 'CREATE TABLE public._acl_probe2_20260807 (id int)';
  SELECT count(*) INTO v_p_anon FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='_acl_probe2_20260807' AND grantee='anon';
  SELECT count(*) INTO v_p_auth FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='_acl_probe2_20260807' AND grantee='authenticated';
  SELECT count(*) INTO v_p_svc  FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='_acl_probe2_20260807' AND grantee='service_role';
  EXECUTE 'DROP TABLE public._acl_probe2_20260807';

  IF v_p_anon <> 0 THEN RAISE EXCEPTION 'プローブに anon の権限が % 件付いた。ロールバック', v_p_anon; END IF;
  IF v_p_auth <> 0 THEN RAISE EXCEPTION 'プローブに authenticated の権限が % 件付いた。ロールバック', v_p_auth; END IF;
  IF v_p_svc  =  0 THEN RAISE EXCEPTION 'プローブに service_role の権限が付かない。巻き込んだ。ロールバック'; END IF;
  RAISE NOTICE '実測: 新規テーブルの権限 anon % 件 / authenticated % 件 / service_role % 件',
    v_p_anon, v_p_auth, v_p_svc;

  -- ③ 既存オブジェクトの権限が1件も変わっていないこと
  SELECT count(*) INTO v_grants FROM information_schema.role_table_grants WHERE table_schema='public';
  SELECT count(*) INTO v_anon   FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='anon';
  SELECT count(*) INTO v_auth   FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='authenticated';
  SELECT count(*) INTO v_tables FROM information_schema.tables WHERE table_schema='public';

  IF v_grants <> 3651 THEN RAISE EXCEPTION '既存の表権限が % 件に変わった（想定3651）。ロールバック', v_grants; END IF;
  IF v_anon   <> 696  THEN RAISE EXCEPTION 'anon の表権限が % 件に変わった（想定696）。ロールバック', v_anon; END IF;
  IF v_auth   <> 981  THEN RAISE EXCEPTION 'authenticated の表権限が % 件に変わった（想定981）。ロールバック', v_auth; END IF;
  IF v_tables <> 141  THEN RAISE EXCEPTION 'テーブルが % 件（想定141）。プローブが残った？ロールバック', v_tables; END IF;

  RAISE NOTICE '完了: 既定ACLは service_role のみ。既存の表権限 % 件は無傷（anon % / authenticated %）',
    v_grants, v_anon, v_auth;
END $$;

COMMIT;
