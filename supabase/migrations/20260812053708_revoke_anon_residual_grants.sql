-- ═══════════════════════════════════════════════════════════════════════════
-- anon の残骸権限を剥がし、RLS 無効のまま anon に開いていた4テーブルを塞ぐ
--
-- ── 背景（2026-08-12 実測）──────────────────────────────────────────────────
-- 20260807050000 / 20260807060000 で既定 ACL は直したが、**既にあったテーブルの
-- 権限は剥がれていない**。旧既定（anon にも arwdDxtm）の残骸が全件に残っていた。
--
--   anon / authenticated の TRUNCATE / REFERENCES / TRIGGER … 各140リレーション
--   anon の INSERT / UPDATE / DELETE                        … 46テーブル
--   **RLS 無効 かつ anon 全権**                              … 4テーブル
--
-- ⚠️ TRUNCATE は RLS の対象外。PostgREST が公開していないので即時の危険は低いが、
--    剥がすのは REVOKE 1行なので放置する理由がない。
--
-- ⚠️ **iv_companies / iv_interviews は実データが anon キーで読めていた。**
--    anon キーはクライアントバンドルに載る公開値なので、実質公開状態だった。
--    実測（本migration適用前）:
--      GET /rest/v1/iv_companies  → 200 [{"name":"株式会社Opinio","jd_text":"【…
--      GET /rest/v1/iv_interviews → 200 [{"id":"dd1d…
--
-- ── ⚠️ このDBは3アプリで共有されている（2026-08-12 判明）───────────────────
-- 同じ Supabase プロジェクト（xtutnecqeamftygufxco）を指す .env を持つリポジトリ:
--
--   opinio-work    … ow_* を使う（このリポジトリ）
--   ai-interview   … iv_* を使う。**読み書きは全て service_role**。
--                    createBrowserClient は定義だけで使用箇所ゼロ（実測）
--   truthmatch     … candidates / jobs / agents / tenants など40テーブルを使う。
--                    **anon キーのブラウザクライアントで書いている**（25ファイル・68箇所）
--
-- ⚠️ **truthmatch が使う40テーブルの anon INSERT/UPDATE/DELETE には触らない。**
--    剥がすと truthmatch のログイン（agent/login・crm/login）、候補者登録
--    （register/profile）、応募（careers/[slug]/[jobId]）が止まる。
--    truthmatch を service_role 経由に寄せるのが先で、順序が逆になる。
--    事後チェックで「40テーブルが手つかずで残っていること」を検証する（誤爆の検知）。
--
-- ⚠️ Edge Functions 0個 / pg_cron 未インストール / Database Webhooks 0本 を確認済み。
--    public の user トリガー22本はテーブル所有者権限で動くので anon の GRANT と無関係。
--
-- ── なぜ RLS も同時に有効化するか ──────────────────────────────────────────
-- GRANT を剥がすだけだと、次に誰かが GRANT を足した瞬間に裸に戻る。
-- CLAUDE.md「GRANT と RLS は二層で持つ」に従い、両方で塞ぐ。
-- ポリシーは**書かない**（＝全拒否）。service_role は rolbypassrls=true なので
-- ai-interview の service_role 経路は影響を受けない（実測で確認済み）。
--
-- ⚠️ authenticated も実質全拒否になる（GRANT は残るが RLS が0行にする）。
--    iv_* / work_histories を authenticated で読むコードは3リポジトリに存在しない。
--
-- ⚠️ **GRANT は1行も書かない。** 既存の必要な権限に触れないため。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック（想定した状態と違えば中止）──────────────────────────────
DO $$
DECLARE
  v_anon_trunc int; v_auth_trunc int; v_anon_sel int; v_anon_iud int; v_untouched int; v_sr int;
  v_rls_off int;
BEGIN
  SELECT count(*) INTO v_anon_trunc FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='anon' AND privilege_type='TRUNCATE';
  SELECT count(*) INTO v_auth_trunc FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='authenticated' AND privilege_type='TRUNCATE';
  SELECT count(DISTINCT table_name) INTO v_anon_sel FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='anon' AND privilege_type='SELECT';
  SELECT count(DISTINCT table_name) INTO v_anon_iud FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='anon' AND privilege_type IN ('INSERT','UPDATE','DELETE');
  SELECT count(DISTINCT table_name) INTO v_untouched FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='anon' AND privilege_type IN ('INSERT','UPDATE','DELETE')
     AND table_name NOT IN ('iv_companies','iv_interviews','iv_messages','work_histories',
                            'ow_job_views','ow_page_views');
  SELECT count(*) INTO v_sr FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='service_role';
  SELECT count(*) INTO v_rls_off FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity
     AND c.relname IN ('iv_companies','iv_interviews','iv_messages','work_histories');

  IF v_anon_trunc <> 140 THEN RAISE EXCEPTION 'anon TRUNCATE が %（想定140）。中止', v_anon_trunc; END IF;
  IF v_auth_trunc <> 140 THEN RAISE EXCEPTION 'authenticated TRUNCATE が %（想定140）。中止', v_auth_trunc; END IF;
  IF v_anon_sel   <> 138 THEN RAISE EXCEPTION 'anon SELECT が %（想定138）。中止', v_anon_sel; END IF;
  IF v_anon_iud   <> 46  THEN RAISE EXCEPTION 'anon IUD が %（想定46）。中止', v_anon_iud; END IF;
  IF v_untouched  <> 40  THEN RAISE EXCEPTION '触らない対象が %（想定40）。中止', v_untouched; END IF;
  IF v_sr         <> 994 THEN RAISE EXCEPTION 'service_role の権限が %（想定994）。中止', v_sr; END IF;
  IF v_rls_off    <> 4   THEN RAISE EXCEPTION 'RLS 無効の対象が %（想定4）。中止', v_rls_off; END IF;

  RAISE NOTICE '適用前: anon TRUNCATE % / anon SELECT % 表 / anon IUD % 表（うち触らない %）/ service_role % 件',
    v_anon_trunc, v_anon_sel, v_anon_iud, v_untouched, v_sr;
END $$;

-- ═══ ① 残骸（TRUNCATE / REFERENCES / TRIGGER）を全件剥がす ═════════════════
-- ⚠️ PostgREST はこの3つを公開していない。3リポジトリのどこも使っていない。
-- ⚠️ SELECT / INSERT / UPDATE / DELETE には触れない（明示的に列挙しているため）。
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

-- ═══ ② RLS 無効のまま anon に開いていた4テーブルを二層で塞ぐ ═══════════════
-- iv_* … ai-interview のもの。service_role のみで読み書きしている
-- work_histories … 3リポジトリのいずれからも参照0件・0行
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.iv_companies   FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.iv_interviews  FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.iv_messages    FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.work_histories FROM anon;

-- ポリシーは書かない＝全拒否。service_role は rolbypassrls=true なので素通りする。
ALTER TABLE public.iv_companies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iv_interviews  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iv_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_histories ENABLE ROW LEVEL SECURITY;

-- ═══ ③ ow_* の書き込み権限を剥がす（SELECT は残す）═══════════════════════════
-- ⚠️ どのリポジトリからも参照0件。RLS は既に有効なので RLS 操作は不要。
-- ⚠️ SELECT は剥がさない。公開ページの集計に使う可能性を残す。
REVOKE INSERT, UPDATE, DELETE ON TABLE public.ow_job_views  FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.ow_page_views FROM anon;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v int; v_txt text;
BEGIN
  -- ① 残骸が0件
  FOR v_txt IN SELECT unnest(ARRAY['TRUNCATE','REFERENCES','TRIGGER']) LOOP
    SELECT count(*) INTO v FROM information_schema.role_table_grants
     WHERE table_schema='public' AND grantee IN ('anon','authenticated') AND privilege_type=v_txt;
    IF v <> 0 THEN RAISE EXCEPTION '% が % 件残っている。ロールバック', v_txt, v; END IF;
  END LOOP;

  -- ② 4テーブルの RLS が有効
  SELECT count(*) INTO v FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relrowsecurity
     AND c.relname IN ('iv_companies','iv_interviews','iv_messages','work_histories');
  IF v <> 4 THEN RAISE EXCEPTION 'RLS が有効になったのが % 件（想定4）。ロールバック', v; END IF;

  -- ③ 4テーブルは anon から一切見えない
  IF has_table_privilege('anon','public.iv_companies','SELECT')
     OR has_table_privilege('anon','public.iv_interviews','SELECT')
     OR has_table_privilege('anon','public.iv_messages','SELECT')
     OR has_table_privilege('anon','public.work_histories','SELECT')
     OR has_table_privilege('anon','public.iv_companies','INSERT')
     OR has_table_privilege('anon','public.work_histories','DELETE') THEN
    RAISE EXCEPTION '4テーブルに anon の権限が残っている。ロールバック';
  END IF;

  -- ④ anon SELECT が 138 → 134（4つだけ減った）
  SELECT count(DISTINCT table_name) INTO v FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='anon' AND privilege_type='SELECT';
  IF v <> 134 THEN RAISE EXCEPTION 'anon SELECT が % 表（想定134）。ロールバック', v; END IF;

  -- ⑤ anon IUD が 46 → 40
  SELECT count(DISTINCT table_name) INTO v FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='anon' AND privilege_type IN ('INSERT','UPDATE','DELETE');
  IF v <> 40 THEN RAISE EXCEPTION 'anon IUD が % 表（想定40）。ロールバック', v; END IF;

  -- ⑥ ⚠️ 誤爆の検知：truthmatch が使う40テーブルが手つかずで残っていること
  SELECT count(DISTINCT table_name) INTO v FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='anon' AND privilege_type IN ('INSERT','UPDATE','DELETE')
     AND table_name NOT IN ('iv_companies','iv_interviews','iv_messages','work_histories',
                            'ow_job_views','ow_page_views');
  IF v <> 40 THEN RAISE EXCEPTION '触らないはずの表が % に変化（想定40）。ロールバック', v; END IF;

  -- ⑦ ow_* は SELECT を残し、書き込みだけ剥がした
  IF NOT has_table_privilege('anon','public.ow_page_views','SELECT')
     OR NOT has_table_privilege('anon','public.ow_job_views','SELECT') THEN
    RAISE EXCEPTION 'ow_*_views の anon SELECT まで剥がしている。ロールバック';
  END IF;
  IF has_table_privilege('anon','public.ow_page_views','INSERT')
     OR has_table_privilege('anon','public.ow_job_views','INSERT') THEN
    RAISE EXCEPTION 'ow_*_views の anon INSERT が残っている。ロールバック';
  END IF;

  -- ⑧ authenticated の SELECT / IUD が無傷（TRUNCATE 等以外は触っていない）
  SELECT count(DISTINCT table_name) INTO v FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='authenticated' AND privilege_type='SELECT';
  IF v <> 139 THEN RAISE EXCEPTION 'authenticated SELECT が % 表（想定139）。ロールバック', v; END IF;
  SELECT count(DISTINCT table_name) INTO v FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='authenticated' AND privilege_type IN ('INSERT','UPDATE','DELETE');
  IF v <> 142 THEN RAISE EXCEPTION 'authenticated IUD が % 表（想定142）。ロールバック', v; END IF;

  -- ⑨ service_role が無傷（ai-interview はこれで動いている）
  SELECT count(*) INTO v FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='service_role';
  IF v <> 994 THEN RAISE EXCEPTION 'service_role の権限が % 件（想定994）。ロールバック', v; END IF;
  IF NOT has_table_privilege('service_role','public.iv_interviews','SELECT')
     OR NOT has_table_privilege('service_role','public.iv_interviews','INSERT')
     OR NOT has_table_privilege('service_role','public.iv_companies','DELETE') THEN
    RAISE EXCEPTION 'service_role が iv_* を操作できない。ロールバック';
  END IF;

  RAISE NOTICE '完了: 残骸(TRUNCATE/REFERENCES/TRIGGER) 0件 / anon SELECT 134表 / anon IUD 40表（触らない40は無傷）/ 4表 RLS 有効 / service_role 994件 無傷';
END $$;

COMMIT;
