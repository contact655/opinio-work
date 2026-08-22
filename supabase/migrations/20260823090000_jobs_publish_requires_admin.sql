-- ============================================================================
-- 求人の公開を運営だけができるようにする（RLS）
--
-- 2026-08-23。**アプリ側（PATCH /api/biz/jobs/[id]）は 20260823 の
-- 7f5c15af で遷移表に直し、企業が `published` を選べないようにした。
-- しかし DB 側は素通りだった。**
--
-- 実測（対処前・is_test の下書き求人で確認し、直後に復元済み）:
--   企業管理者のセッションで PostgREST を直接叩く
--     PATCH /rest/v1/ow_jobs?id=eq.<自社の求人> {"status":"published"}
--   → **204。status が published になった。**
--   ＝ アプリの制限は迂回でき、**審査を経ずに公開できた。**
--
-- ⚠️ **原因は `ow_jobs_company_admin_manage` が `FOR ALL` だったこと。**
--    「自社の求人なら何でもしてよい」という書き方で、
--    **どの列をどう変えてよいかを見ていなかった。**
--
-- ⚠️ Opinio は有料職業紹介事業の許可事業者で、募集情報等提供事業の届出を
--    準備している。**「すべての求人が審査を経て公開される」と書けるかどうかが
--    この1本のポリシーに掛かっている。** アプリの実装だけでは根拠にならない。
--
-- ── 直し方 ──────────────────────────────────────────────────────────────
-- `FOR ALL` を **SELECT / INSERT / UPDATE / DELETE の4本に分け、
-- UPDATE だけに「status を運営専用の値に変えられない」条件を付ける。**
--
--   企業が設定してよい status … draft / pending_review / private
--   運営だけが設定できる status … published / rejected
--
-- ⚠️ **WITH CHECK に書く。** USING は「どの行を触ってよいか」、
--    WITH CHECK は「変更後の行が満たすべき条件」。
--    公開を止めたいのは**変更後の値**なので WITH CHECK 側。
--    USING にだけ書くと、変更前が draft なら published にできてしまう。
--
-- ⚠️ **運営（auth_is_admin）は WITH CHECK を通す。** admin も authenticated
--    ロールで来るため（CLAUDE.md）、条件に入れないと運営画面が動かなくなる。
--    ただし運営画面は admin クライアント（service_role）なので RLS は
--    そもそも迂回する。**将来ブラウザ経路に変えたときのための保険。**
--
-- ── ついでに落とす死んだポリシー ────────────────────────────────────────
--   ・`ow_jobs_public_read` … `status = 'active'` を見ている。
--     **`active` は 2026-08-11 に CHECK ごと削除した値**で、実データ0件。
--     `ow_jobs_published_read` と重複しており、常に false を返すだけ。
--   ⚠️ `ow_jobs_own_*`（4本）は `ow_companies.user_id` を見ている。
--      この列は87社中2社にしか入っておらず実質未使用（CLAUDE.md）だが、
--      **今回は消さない。** 消すと「誰にも開いていない」判定が変わる範囲が
--      広がるので、企業管理者の経路を直すことに絞る。
--
-- ── 復元用 ──────────────────────────────────────────────────────────────
-- DROP POLICY ow_jobs_company_admin_select ON public.ow_jobs;
-- DROP POLICY ow_jobs_company_admin_insert ON public.ow_jobs;
-- DROP POLICY ow_jobs_company_admin_update ON public.ow_jobs;
-- DROP POLICY ow_jobs_company_admin_delete ON public.ow_jobs;
-- CREATE POLICY ow_jobs_company_admin_manage ON public.ow_jobs FOR ALL
--   USING (company_id IN (SELECT ca.company_id FROM ow_company_admins ca
--     WHERE ca.user_id IN (SELECT u.id FROM ow_users u WHERE u.auth_id = auth.uid())
--       AND ca.is_active = true));
-- CREATE POLICY ow_jobs_public_read ON public.ow_jobs FOR SELECT USING (status = 'active');
-- 作業前ダンプ: .dumps/20260823-0112-ow_jobs.sql（36,254バイト / 20行）
-- ============================================================================

-- ── ① 適用前の検算 ──────────────────────────────────────────────────────
DO $$
DECLARE
  v_all int; v_active int; v_jobs int;
BEGIN
  SELECT count(*) INTO v_all FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_jobs' AND p.polname='ow_jobs_company_admin_manage' AND p.polcmd='*';
  IF v_all <> 1 THEN
    RAISE EXCEPTION 'ow_jobs_company_admin_manage（FOR ALL）が見つからない。前提が変わっている';
  END IF;

  SELECT count(*) INTO v_active FROM public.ow_jobs WHERE status='active';
  IF v_active <> 0 THEN
    RAISE EXCEPTION 'status=active の求人が%件ある。ow_jobs_public_read を消せない', v_active;
  END IF;

  SELECT count(*) INTO v_jobs FROM public.ow_jobs;
  RAISE NOTICE '適用前: 求人%件 / active 0件 / FOR ALL ポリシー 1本', v_jobs;
END $$;

-- ── ② FOR ALL を4本に分ける ────────────────────────────────────────────
DROP POLICY ow_jobs_company_admin_manage ON public.ow_jobs;

-- 自社の求人か（4本で共通に使う条件）
CREATE POLICY ow_jobs_company_admin_select ON public.ow_jobs
  FOR SELECT USING (public.auth_is_company_admin(company_id));

CREATE POLICY ow_jobs_company_admin_insert ON public.ow_jobs
  FOR INSERT WITH CHECK (
    public.auth_is_company_admin(company_id)
    /* ⚠️ 新規作成は下書きから。作成時点で公開・差し戻しにはできない。
          アプリ（POST /api/biz/jobs）も status:"draft" を固定で入れている。 */
    AND (status IS NULL OR status IN ('draft', 'pending_review'))
  );

CREATE POLICY ow_jobs_company_admin_update ON public.ow_jobs
  FOR UPDATE
  USING (public.auth_is_company_admin(company_id))
  WITH CHECK (
    public.auth_is_company_admin(company_id)
    /* ★ここが本題。**変更後の status** を企業が設定してよい値に限る。
         published / rejected は運営だけ（/admin/jobs の approveJob / rejectJob）。
       ⚠️ 運営は auth_is_admin で通す。admin も authenticated ロールで来るため。 */
    AND (
      public.auth_is_admin()
      OR status IN ('draft', 'pending_review', 'private')
    )
  );

CREATE POLICY ow_jobs_company_admin_delete ON public.ow_jobs
  FOR DELETE USING (public.auth_is_company_admin(company_id));

-- ── ③ 死んだポリシーを落とす ────────────────────────────────────────────
-- `status = 'active'` は 2026-08-11 に CHECK ごと消した値。常に false。
DROP POLICY ow_jobs_public_read ON public.ow_jobs;

-- ── ④ 適用後の検算 ──────────────────────────────────────────────────────
-- ⚠️ catalog を見ているだけ。**実際の応答は適用後に企業管理者のセッションで
--    PostgREST を叩いて確かめること**（CLAUDE.md）。
DO $$
DECLARE
  v int;
BEGIN
  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_jobs' AND p.polcmd='*';
  IF v <> 0 THEN RAISE EXCEPTION 'FOR ALL のポリシーが%本残っている', v; END IF;

  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_jobs' AND p.polname='ow_jobs_company_admin_update'
     AND pg_get_expr(p.polwithcheck, p.polrelid) ~ 'pending_review';
  IF v <> 1 THEN RAISE EXCEPTION 'UPDATE の WITH CHECK に status の制限が入っていない'; END IF;

  IF EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
              WHERE c.relname='ow_jobs' AND p.polname='ow_jobs_public_read') THEN
    RAISE EXCEPTION 'ow_jobs_public_read が残っている';
  END IF;

  -- 公開求人が未ログインから読めること（ow_jobs_published_read が担う）
  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_jobs' AND p.polname='ow_jobs_published_read';
  IF v <> 1 THEN RAISE EXCEPTION '公開求人を読ませるポリシーが無い'; END IF;

  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname='ow_jobs';
  RAISE NOTICE 'ow_jobs のポリシー %本（FOR ALL 0本 / UPDATE に status 制限あり）', v;
END $$;
