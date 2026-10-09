-- ════════════════════════════════════════════════════════════════════════
-- ow_jobs の公開読み取りを「公開中・検証用でない」求人だけにする（2026-10-09）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★何が起きていたか
--   `ow_jobs_published_read`（全ロール向け SELECT）が `status IN ('active','published')` だけを見ており、
--   **検証用の求人（is_test = true）でも published なら、誰でも PostgREST から読めた。**
--   公開ページは `PUBLIC_JOB_MATCH` で落としているが、API を直接叩く経路は素通しだった。
--   ⚠️ 'active' は 2026-08-11 に CHECK から外した値で、残っていても当たらない。同時に外す。
--
-- ★差し替え後
--   USING (status = 'published' AND is_test = false)
--   → `lib/jobs/publicJobs.ts` の PUBLIC_JOB_MATCH と同じ条件。
--   ⚠️ 企業が is_test なら求人も is_test（20261009090000 のトリガー）なので、検証用企業の求人も落ちる。
--
-- ★残る読み取り経路（適用前に確認済み）
--   ・/biz（企業の担当者）… `ow_jobs_company_admin_select`（auth_is_company_admin）。検証用企業の
--     担当者も自社の求人を下書き・検証用を含めて読める。この migration では触らない。
--   ・/admin（運営）… createAdminClient（service_role は RLS を通らない）。
--   ・`ow_jobs_own_select`（ow_companies.user_id）… 触らない。
--
-- ⚠️ 影響: 検証用の求職者アカウントも、検証用の求人を読めなくなる。
--    ＝ `POST /api/applications`（セッションのクライアントで求人を引く）から検証用の求人へは
--    応募できない（404）。公開側に出ない求人なので、意図どおり。
--
-- ⚠️ 作業前ダンプ: .dumps/20261009-1528-ow_jobs.sql（ポリシー9本を含む）
-- ════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists ow_jobs_published_read on public.ow_jobs;
create policy ow_jobs_published_read on public.ow_jobs
  for select
  using (status = 'published' and is_test = false);

comment on policy ow_jobs_published_read on public.ow_jobs is
  '誰でも読める求人は「公開中かつ検証用でない」だけ（2026-10-09）。lib/jobs/publicJobs.ts の PUBLIC_JOB_MATCH と同じ条件。';

-- ── 検算 ──────────────────────────────────────────────────────────────────
do $$
declare v text;
begin
  select pg_get_expr(polqual, polrelid) into v
    from pg_policy where polrelid = 'public.ow_jobs'::regclass and polname = 'ow_jobs_published_read';
  if v is null or v !~ 'is_test' or v ~ 'active' then
    raise exception '検算失敗: ow_jobs_published_read の条件が想定と違う: %', v;
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.ow_jobs'::regclass
                  and polname = 'ow_jobs_company_admin_select') then
    raise exception '検算失敗: ow_jobs_company_admin_select が無い（/biz から自社の求人が読めなくなる）';
  end if;
  raise notice '検算OK: %', v;
end $$;

commit;

-- ★戻すとき（適用前の定義そのまま）:
--   drop policy ow_jobs_published_read on public.ow_jobs;
--   create policy ow_jobs_published_read on public.ow_jobs
--     for select
--     using (status = any (array['active'::text, 'published'::text]));
