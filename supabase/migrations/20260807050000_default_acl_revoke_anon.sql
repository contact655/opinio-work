-- ═══════════════════════════════════════════════════════════════════════════
-- public スキーマの既定ACLから anon を落とす（これから作るオブジェクトだけ）
--
-- ── なぜ（2026-08-07）──────────────────────────────────────────────────────
-- `pg_default_acl` が anon に arwdDxtm（全権限）を付ける設定になっており、
-- **CREATE TABLE しただけで未ログインから読み書きできるテーブルが増える**。
-- 2026-08-06 に anon の書き込みを94テーブルから剥がしたが、
-- 既定を直さないと**テーブルを作るたびに再生産される**。
-- 実際 2026-08-07 の ow_profile_desired_roles でも、
-- migration の中で明示的に REVOKE するまで anon に全権限が付いていた。
--
-- ⚠️ **既存オブジェクトの権限は1つも変えない。** 既定ACLは
--    「これから作られるもの」にしか効かない。既存の是正は別 migration の仕事。
--
-- ⚠️ ALTER DEFAULT PRIVILEGES は**実行したロールごと**に効く。
--    このプロジェクトでテーブルを作るのは `postgres`（実測: current_user = postgres /
--    ow_profile_desired_roles の所有者 = postgres）。よって FOR ROLE postgres に設定する。
--    `supabase_admin` にも既定ACLがあるが、postgres は supabase_admin のメンバーではなく
--    （pg_has_role = false）変更できない。Supabase 内部が作るオブジェクト用なので触らない。
--
-- ⚠️ service_role は触らない。admin クライアントが RLS をバイパスして使う。
-- ⚠️ authenticated も**今回は触らない**。判断材料は報告に添えた。
--
-- ── 考え方：GRANT と RLS の二層防御 ────────────────────────────────────────
-- anon に GRANT が無いと、PostgREST は **401 permission denied for table** を返し、
-- **RLS を評価する前に止まる**。RLS ポリシーを1本書き間違えても漏れない。
-- 逆に GRANT があると、RLS だけが最後の砦になる。層は2つ持つ。
--
-- ⚠️ 関数（FUNCTIONS）の既定からも anon を落とす。踏みやすい罠が1つある:
--    **RLS ポリシーが呼ぶ関数には anon にも EXECUTE が要る。**
--    TO 句の無いポリシーは anon でも評価されるため、EXECUTE が無いと
--    クエリ自体がエラーになる（auth_ow_user_id() で経験済み）。
--    今後ポリシーから呼ぶ関数を作るときは
--    `GRANT EXECUTE ON FUNCTION ... TO anon, authenticated, service_role;` を明示すること。
--    既存の関数の権限は変わらないので、今日壊れるものは無い。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_acl text; v_grants int; v_anon int; v_auth int; v_tables int;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'この migration は postgres で流す前提（現在 %）。中止', current_user;
  END IF;

  SELECT defaclacl::text INTO v_acl FROM pg_default_acl
   WHERE defaclnamespace='public'::regnamespace
     AND defaclrole='postgres'::regrole AND defaclobjtype='r';
  IF v_acl IS NULL OR v_acl NOT LIKE '%anon=%' THEN
    RAISE EXCEPTION 'postgres/TABLES の既定ACLに anon が無い。既に適用済み？中止（現在: %）', coalesce(v_acl,'(行なし)');
  END IF;

  SELECT count(*) INTO v_grants FROM information_schema.role_table_grants WHERE table_schema='public';
  SELECT count(*) INTO v_anon   FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='anon';
  SELECT count(*) INTO v_auth   FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='authenticated';
  SELECT count(*) INTO v_tables FROM information_schema.tables WHERE table_schema='public';

  IF v_grants <> 3651 THEN RAISE EXCEPTION '既存の表権限が % 件（想定3651）。中止', v_grants; END IF;
  IF v_anon   <> 696  THEN RAISE EXCEPTION 'anon の表権限が % 件（想定696）。中止', v_anon; END IF;
  IF v_auth   <> 981  THEN RAISE EXCEPTION 'authenticated の表権限が % 件（想定981）。中止', v_auth; END IF;
  IF v_tables <> 141  THEN RAISE EXCEPTION 'テーブルが % 件（想定141）。中止', v_tables; END IF;

  RAISE NOTICE '適用前: 既定ACL(postgres/TABLES) = % / 既存の表権限 % 件（anon % / authenticated %）',
    v_acl, v_grants, v_anon, v_auth;
END $$;

-- ── 既定ACLから anon を落とす（テーブル・ビュー / シーケンス / 関数）────────
-- ⚠️ ビューは TABLES に含まれる。TYPES / SCHEMAS は anon に既定が無いので触らない。
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_acl text; v_bad text; v_grants int; v_anon int; v_auth int; v_tables int;
  v_probe_anon int; v_probe_auth int; r record;
BEGIN
  -- ① 既定ACL から anon が消え、authenticated / service_role は残っていること
  FOR r IN SELECT unnest(ARRAY['r','S','f']) AS t LOOP
    SELECT defaclacl::text INTO v_acl FROM pg_default_acl
     WHERE defaclnamespace='public'::regnamespace
       AND defaclrole='postgres'::regrole AND defaclobjtype=r.t;
    IF v_acl IS NOT NULL AND v_acl LIKE '%anon=%' THEN
      RAISE EXCEPTION '既定ACL(%) にまだ anon がいる: %。ロールバック', r.t, v_acl;
    END IF;
    IF v_acl IS NULL OR v_acl NOT LIKE '%authenticated=%' THEN
      RAISE EXCEPTION '既定ACL(%) から authenticated まで消えた: %。ロールバック', r.t, coalesce(v_acl,'(行なし)');
    END IF;
    IF v_acl NOT LIKE '%service_role=%' THEN
      RAISE EXCEPTION '既定ACL(%) から service_role まで消えた: %。ロールバック', r.t, v_acl;
    END IF;
    RAISE NOTICE '適用後 既定ACL(%) = %', r.t, v_acl;
  END LOOP;

  -- ② 実測: テスト用テーブルを作り、anon に権限が付かないことを確かめて捨てる
  EXECUTE 'CREATE TABLE public._acl_probe_20260807 (id int)';
  SELECT count(*) INTO v_probe_anon FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='_acl_probe_20260807' AND grantee='anon';
  SELECT count(*) INTO v_probe_auth FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='_acl_probe_20260807' AND grantee='authenticated';
  EXECUTE 'DROP TABLE public._acl_probe_20260807';

  IF v_probe_anon <> 0 THEN
    RAISE EXCEPTION '新規テーブルに anon の権限が % 件付いた。既定が効いていない。ロールバック', v_probe_anon;
  END IF;
  IF v_probe_auth = 0 THEN
    RAISE EXCEPTION '新規テーブルに authenticated の権限が付かない。巻き込んだ。ロールバック';
  END IF;
  RAISE NOTICE '実測: 新規テーブルの権限 anon % 件 / authenticated % 件', v_probe_anon, v_probe_auth;

  -- ③ 既存オブジェクトの権限が1つも変わっていないこと
  SELECT count(*) INTO v_grants FROM information_schema.role_table_grants WHERE table_schema='public';
  SELECT count(*) INTO v_anon   FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='anon';
  SELECT count(*) INTO v_auth   FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='authenticated';
  SELECT count(*) INTO v_tables FROM information_schema.tables WHERE table_schema='public';

  IF v_grants <> 3651 THEN RAISE EXCEPTION '既存の表権限が % 件に変わった（想定3651）。ロールバック', v_grants; END IF;
  IF v_anon   <> 696  THEN RAISE EXCEPTION 'anon の表権限が % 件に変わった（想定696）。ロールバック', v_anon; END IF;
  IF v_auth   <> 981  THEN RAISE EXCEPTION 'authenticated の表権限が % 件に変わった（想定981）。ロールバック', v_auth; END IF;
  IF v_tables <> 141  THEN RAISE EXCEPTION 'テーブルが % 件（想定141）。プローブが残った？ロールバック', v_tables; END IF;

  RAISE NOTICE '完了: 既定ACLから anon を除去。既存の表権限 % 件は無傷（anon % / authenticated %）',
    v_grants, v_anon, v_auth;
END $$;

COMMIT;
