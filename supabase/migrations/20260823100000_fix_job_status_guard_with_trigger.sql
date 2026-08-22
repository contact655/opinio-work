-- ============================================================================
-- 求人の status 遷移の制限を、RLS の WITH CHECK からトリガーに移す
--
-- 2026-08-23。直前の 20260823090000 で
--   WITH CHECK (auth_is_company_admin(company_id)
--               AND (auth_is_admin() OR status IN ('draft','pending_review','private')))
-- と書いたが、**これは間違いだった。**
--
-- ⚠️ **WITH CHECK は「変更後の行」を見る。「変更されたか」は見られない。**
--    そのため **公開中（published）の求人はタイトルすら直せなくなった**
--    （変更後の行の status が published のままなので条件を満たさない）。
--    実測: 企業管理者が自社の公開求人の title を更新 → **403（42501）**。
--
-- ⚠️ **止めたいのは「status が published である行」ではなく
--    「status を published に *変える* こと」。** 前後の比較が要るので、
--    OLD と NEW を見られる**トリガー**が正しい置き場所。
--
-- ── 直し方 ──────────────────────────────────────────────────────────────
--   ・UPDATE の WITH CHECK は「自社の求人か」だけに戻す
--   ・status の遷移は BEFORE UPDATE トリガーで見る
--       - status が変わらない場合は何もしない（＝内容の編集は自由）
--       - service_role（運営画面の admin クライアント）は通す
--       - auth_is_admin() の運営も通す
--       - それ以外は draft / pending_review / private のみ
--
-- ⚠️ **service_role を通すこと。** `/admin/jobs` の approveJob / rejectJob は
--    admin クライアント（service_role）で UPDATE する。RLS は迂回するが
--    **トリガーは迂回しない。** 除外し忘れると運営が公開できなくなる。
--
-- ⚠️ INSERT 側の制限（draft / pending_review のみ）は 090000 のまま残す。
--    新規作成には OLD が無いので WITH CHECK で正しく書ける。
--
-- ── 復元用 ──────────────────────────────────────────────────────────────
-- DROP TRIGGER trg_guard_job_status ON public.ow_jobs;
-- DROP FUNCTION public.guard_job_status_transition();
-- （WITH CHECK を 090000 の形に戻す必要はない。あれは誤りだった）
-- ============================================================================

-- ── ① UPDATE の WITH CHECK を「自社の求人か」だけに戻す ────────────────
DROP POLICY ow_jobs_company_admin_update ON public.ow_jobs;

CREATE POLICY ow_jobs_company_admin_update ON public.ow_jobs
  FOR UPDATE
  USING (public.auth_is_company_admin(company_id))
  WITH CHECK (public.auth_is_company_admin(company_id));

-- ── ② status の遷移をトリガーで見る ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_job_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER          -- ⚠️ 呼び出し元のロールを見たいので INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  -- status が変わっていなければ何もしない（内容の編集は自由）
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  /* 運営の経路はそのまま通す。
     ⚠️ `/admin/jobs` は admin クライアント（service_role）で UPDATE する。
        RLS は迂回するが**トリガーは迂回しない**ので、ここで除外する。 */
  IF current_user = 'service_role' OR public.auth_is_admin() THEN
    RETURN NEW;
  END IF;

  /* 企業が設定してよい status。published / rejected は運営専用。
     ⚠️ アプリ側（lib/business/jobs.ts の JOB_STATUS_TRANSITIONS）と同じ語彙。
        値を足すときは両方直すこと（CLAUDE.md「UI / API / DB を3つ揃える」）。 */
  IF NEW.status NOT IN ('draft', 'pending_review', 'private') THEN
    RAISE EXCEPTION '求人の公開・差し戻しは運営が行います（% は設定できません）', NEW.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_job_status ON public.ow_jobs;
CREATE TRIGGER trg_guard_job_status
  BEFORE UPDATE ON public.ow_jobs
  FOR EACH ROW EXECUTE FUNCTION public.guard_job_status_transition();

-- ── ③ 検算 ──────────────────────────────────────────────────────────────
-- ⚠️ catalog を見ているだけ。**実際の応答は適用後に企業管理者のセッションで
--    PostgREST を叩いて確かめること。**
--    とくに「公開中の求人の内容を編集できること」を必ず見る（今回の退行）。
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   WHERE c.relname='ow_jobs' AND t.tgname='trg_guard_job_status' AND NOT t.tgisinternal;
  IF v <> 1 THEN RAISE EXCEPTION 'トリガーが張られていない'; END IF;

  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_jobs' AND p.polname='ow_jobs_company_admin_update'
     AND pg_get_expr(p.polwithcheck,p.polrelid) ~ 'pending_review';
  IF v <> 0 THEN RAISE EXCEPTION 'UPDATE の WITH CHECK に status の条件が残っている'; END IF;

  -- 公開中の求人が5件のままであること（検証で動かしていないこと）
  SELECT count(*) INTO v FROM public.ow_jobs WHERE status='published' AND is_test=false;
  IF v <> 5 THEN RAISE EXCEPTION '公開求人が5件ではない（%件）', v; END IF;

  RAISE NOTICE 'トリガー1本 / WITH CHECK は所属判定のみ / 公開求人5件';
END $$;
