-- ============================================================================
-- ow_job_roles / ow_company_genres に企業管理者の書き込みポリシーを作る
--
-- 2026-08-23。0行更新の横断調査で見つかった。
--
-- ── 何が起きていたか ────────────────────────────────────────────────────
-- どちらも **RLS 有効・`authenticated` に GRANT あり・書き込みポリシー0本**。
-- 読み取りのポリシーしか無く、企業側の書き込みが**通っていなかった。**
--
-- 実測（企業管理者のセッションで、アプリと同じ「消して入れ直す」）:
--   DELETE  status=200 **行数0**  → 消えない（黙って0行）
--   INSERT  status=403           → 入らない（RLS違反）
--   SELECT  status=200 件数1     → 読み取りは通る（陽性対照）
--
-- ⚠️ **これが「食い違いの製造機」になっていた。**
--    `api/biz/jobs` は次の順で書く:
--      ① `ow_job_roles` を delete → ② insert → ③ `syncJobCategoryFromRoles`
--    ①②が失敗しても、**③（`ow_jobs.role_category_id` と `job_category`）は成功する**
--    （`ow_jobs` は企業管理者が更新できるため）。
--    しかも `try { } catch { }` で囲まれているが、**supabase-js は例外を投げない**
--    ので捕まらない。**職種の正（`ow_job_roles`）だけが古いまま残る。**
--
-- ⚠️ 現時点の実データは食い違い0件（20求人すべて一致）。
--    企業側から職種を編集した実績が無いため、まだ表面化していない。
--
-- ── 条件をどう書くか ────────────────────────────────────────────────────
-- **`auth_is_company_admin` に揃える（member には広げない）。**
-- 求人の作成・編集は `requireAdmin(ctx.allMemberships, companyId)` で
-- admin 限定なので、DB 側だけ緩めると入口と食い違う。
--
-- ⚠️ **UPDATE は作らない。** アプリは「全部消して入れ直す」方式で、
--    既存行を更新する経路が無い（`is_primary` の付け替えも入れ直しで表現する）。
--    要らないポリシーを置くと、次に読む人が「更新経路がある」と誤解する。
--
-- ⚠️ **運営（service_role）は RLS を迂回する**ので、`/admin/jobs` の
--    `updateJobRoles` は従来どおり動く。ポリシーを足しても壊れない。
--
-- ── 復元用 ──────────────────────────────────────────────────────────────
-- DROP POLICY ow_job_roles_company_admin_insert ON public.ow_job_roles;
-- DROP POLICY ow_job_roles_company_admin_delete ON public.ow_job_roles;
-- DROP POLICY ow_company_genres_company_admin_insert ON public.ow_company_genres;
-- DROP POLICY ow_company_genres_company_admin_delete ON public.ow_company_genres;
-- 作業前ダンプ: .dumps/20260823-*-ow_job_roles-ow_company_genres.sql
-- ============================================================================

-- ── ① 適用前の検算 ──────────────────────────────────────────────────────
DO $$
DECLARE v_jr int; v_cg int; v_pol int;
BEGIN
  SELECT count(*) INTO v_jr FROM public.ow_job_roles;
  SELECT count(*) INTO v_cg FROM public.ow_company_genres;
  IF v_jr <> 20 OR v_cg <> 4 THEN
    RAISE EXCEPTION '前提が変わっている（job_roles %行 / company_genres %行）', v_jr, v_cg;
  END IF;

  SELECT count(*) INTO v_pol FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname IN ('ow_job_roles','ow_company_genres') AND p.polcmd IN ('a','w','d','*');
  IF v_pol <> 0 THEN
    RAISE EXCEPTION '書き込みポリシーが既に%本ある', v_pol;
  END IF;

  RAISE NOTICE '適用前: job_roles 20行 / company_genres 4行 / 書き込みポリシー 0本';
END $$;

-- ── ② ow_job_roles ──────────────────────────────────────────────────────
-- 「その求人が属する企業の管理者か」を求人から辿って判定する。
CREATE POLICY ow_job_roles_company_admin_insert ON public.ow_job_roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ow_jobs j
       WHERE j.id = ow_job_roles.job_id
         AND public.auth_is_company_admin(j.company_id)
    )
  );

CREATE POLICY ow_job_roles_company_admin_delete ON public.ow_job_roles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ow_jobs j
       WHERE j.id = ow_job_roles.job_id
         AND public.auth_is_company_admin(j.company_id)
    )
  );

-- ── ③ ow_company_genres ─────────────────────────────────────────────────
CREATE POLICY ow_company_genres_company_admin_insert ON public.ow_company_genres
  FOR INSERT
  WITH CHECK (public.auth_is_company_admin(company_id));

CREATE POLICY ow_company_genres_company_admin_delete ON public.ow_company_genres
  FOR DELETE
  USING (public.auth_is_company_admin(company_id));

-- ── ④ 適用後の検算 ──────────────────────────────────────────────────────
-- ⚠️ catalog を見ているだけ。**実際の応答は適用後に企業管理者のセッションで
--    PostgREST を叩いて確かめること**（今回まさにそれで見つけた）。
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_job_roles' AND p.polcmd IN ('a','d');
  IF v <> 2 THEN RAISE EXCEPTION 'ow_job_roles の INSERT/DELETE が2本ではない（%本）', v; END IF;

  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_company_genres' AND p.polcmd IN ('a','d');
  IF v <> 2 THEN RAISE EXCEPTION 'ow_company_genres の INSERT/DELETE が2本ではない（%本）', v; END IF;

  -- UPDATE を作っていないこと（入れ替え方式なので要らない）
  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname IN ('ow_job_roles','ow_company_genres') AND p.polcmd IN ('w','*');
  IF v <> 0 THEN RAISE EXCEPTION 'UPDATE/ALL のポリシーが%本ある（作らない方針）', v; END IF;

  -- データは触っていないこと
  IF (SELECT count(*) FROM public.ow_job_roles) <> 20
     OR (SELECT count(*) FROM public.ow_company_genres) <> 4 THEN
    RAISE EXCEPTION 'データが変わっている';
  END IF;

  RAISE NOTICE '両表とも INSERT/DELETE 2本ずつ / UPDATE なし / 行数そのまま';
END $$;
