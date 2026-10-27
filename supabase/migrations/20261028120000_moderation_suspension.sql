-- ════════════════════════════════════════════════════════════════════════════
-- 会社ページの「停止」（運営だけ）と、停止・解除の履歴（2026-10-28 / 柴さんの判断）
--
-- ★方針
--   ・会社: suspended_at / suspended_by / suspension_reason を新設。停止中 = suspended_at IS NOT NULL
--     停止するときは、停止前の is_published / listing_status を suspended_prev_* に退避して
--     is_published = false / listing_status = 'draft' に倒す（書き込みはアプリの運営経路）。
--     ⚠️ 倒すのは、is_published を直接見ている経路（約30か所。sitemap・職歴のリンク・フィードの
--        isCompanyPostAlive など）を1つも取りこぼさないため。RLS とヘルパーの suspended_at 条件は二重の守り。
--   ・募集: 停止は既存の stopped_* を使う（2026-10-12 から実装済み）。新設しない。
--     会社が停止中のあいだ、その会社の募集を一般に出さないために ow_jobs.company_suspended を持つ
--     （is_test と同じ「会社 → 募集」へ写す形。PUBLIC_JOB_MATCH 1か所で全経路に効く）。
--   ・履歴: ow_moderation_actions（会社・募集の両方。運営専用）
--
-- ⚠️ 既存の公開中の会社ページ・募集の表示は変わらない（停止中の行は0件で生まれる）。下の検算で確かめる。
-- ⚠️ 戻し方: 末尾のコメント。
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 事前の数（検算用）──────────────────────────────────────────────────────
create temp table _before on commit drop as
select
  (select count(*) from ow_companies where is_published = true and is_test = false) as co_published,
  (select count(*) from ow_companies where is_published = true and listing_status = 'listed' and is_test = false) as co_listed,
  (select count(*) from ow_jobs where status = 'published' and is_test = false) as jobs_published;

-- ── 1. 会社の停止の列 ─────────────────────────────────────────────────────
alter table public.ow_companies
  add column suspended_at                  timestamptz,
  add column suspended_by                  uuid references public.ow_users(id) on delete set null,
  add column suspension_reason             text,
  add column suspended_prev_is_published   boolean,
  add column suspended_prev_listing_status public.listing_status_enum,
  add column unsuspend_requested_at        timestamptz;

alter table public.ow_companies
  add constraint ow_companies_suspension_consistency check (
    (suspended_at is null
       and suspension_reason is null
       and suspended_prev_is_published is null
       and suspended_prev_listing_status is null
       and unsuspend_requested_at is null)
    or
    (suspended_at is not null
       and suspension_reason is not null
       and char_length(btrim(suspension_reason)) between 1 and 1000)
  );

comment on column public.ow_companies.suspended_at is
  '運営が停止した日時。NULL = 停止していない。書けるのは運営だけ（trg_guard_company_approval）';
comment on column public.ow_companies.suspension_reason is
  '停止の理由（企業に送る文面）。停止中は必須';
comment on column public.ow_companies.suspended_prev_is_published is
  '停止前の is_published。解除のときに戻す';
comment on column public.ow_companies.suspended_prev_listing_status is
  '停止前の listing_status。解除のときに戻す';
comment on column public.ow_companies.unsuspend_requested_at is
  '企業が「停止解除を依頼」を押した日時。解除で NULL に戻る';

-- ⚠️ GRANT は配らない。ow_companies の UPDATE は列単位なので、authenticated はこの6列を書けない（403）。
--    SELECT は anon / authenticated ともテーブルレベル（2026-10-28 実測 0列欠け）なので、自社の停止理由は読める。

-- ── 2. 募集: 会社が停止中か（会社 → 募集へ写す）──────────────────────────
alter table public.ow_jobs
  add column company_suspended boolean not null default false;

comment on column public.ow_jobs.company_suspended is
  '会社が停止中か（ow_companies.suspended_at から写す。手で書かない）。公開の判定は status = published かつ is_test = false かつ company_suspended = false';

-- 募集を作る・更新するたびに会社から写し直す（企業が書き換えても戻る）
create or replace function public.sync_job_company_suspended()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.company_suspended := exists (
    select 1 from ow_companies c where c.id = new.company_id and c.suspended_at is not null
  );
  return new;
end;
$$;
revoke execute on function public.sync_job_company_suspended() from public, anon, authenticated;

create trigger trg_ow_jobs_company_suspended
  before insert or update on public.ow_jobs
  for each row execute function public.sync_job_company_suspended();

-- 会社の停止・解除を、その会社の募集へ写す
create or replace function public.propagate_company_suspension_to_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update ow_jobs set company_suspended = (new.suspended_at is not null)
   where company_id = new.id
     and company_suspended is distinct from (new.suspended_at is not null);
  return null;
end;
$$;
revoke execute on function public.propagate_company_suspension_to_jobs() from public, anon, authenticated;

create trigger trg_ow_companies_propagate_suspension
  after update of suspended_at on public.ow_companies
  for each row
  when (old.suspended_at is distinct from new.suspended_at)
  execute function public.propagate_company_suspension_to_jobs();

-- ── 3. 履歴（会社・募集の両方。運営専用）─────────────────────────────────
create table public.ow_moderation_actions (
  id               uuid primary key default gen_random_uuid(),
  target_type      text not null check (target_type in ('company', 'job')),
  target_id        uuid not null,
  action           text not null check (action in ('suspend', 'unsuspend', 'unsuspend_requested', 'decline_reopen')),
  reason           text check (reason is null or char_length(reason) <= 1000),
  actor_user_id    uuid references public.ow_users(id) on delete set null,
  actor_company_id uuid references public.ow_companies(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint ow_moderation_actions_reason_required check (
    action not in ('suspend', 'decline_reopen') or (reason is not null and char_length(btrim(reason)) > 0)
  )
);
-- ⚠️ target_id には FK を張れない（会社と募集の2種類を指す）。会社・募集を消しても履歴は残る。
create index ow_moderation_actions_target_idx on public.ow_moderation_actions (target_type, target_id, created_at desc);

alter table public.ow_moderation_actions enable row level security;
revoke all on public.ow_moderation_actions from anon, authenticated;
-- ⚠️ ポリシーは書かない（ow_transitions と同じ形。読み書きは admin クライアントだけ）

comment on table public.ow_moderation_actions is
  '運営の停止・解除と、企業の解除依頼の履歴。会社（ow_companies）と募集（ow_jobs）の両方。運営専用';

-- ── 4. 一般公開の判定に「停止中でない」を足す（RLS）────────────────────
drop policy ow_companies_published_read on public.ow_companies;
create policy ow_companies_published_read on public.ow_companies
  for select
  using (is_published = true and suspended_at is null and ((is_test = false) or auth_is_test_user()));

drop policy ow_jobs_published_read on public.ow_jobs;
create policy ow_jobs_published_read on public.ow_jobs
  for select
  using (status = 'published' and is_test = false and company_suspended = false);

-- ── 5. 数える関数（企業からのメッセージを受け取る範囲の設定画面）────────────
--   ⚠️ CREATE OR REPLACE（ACL を保つ）。本文は suspended_at の条件を足しただけ。
create or replace function public.count_companies_in_approach_range(p_ow_user_id uuid)
 returns integer
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select count(*)::int
    from ow_companies c
   where c.is_published = true
     and c.suspended_at is null
     and c.is_test is not true
     and not exists (select 1 from ow_approach_blocked_companies b where b.user_id = p_ow_user_id and b.company_id = c.id)
     and public.company_in_approach_range(c.id, p_ow_user_id);
$function$;

create or replace function public.approach_range_option_counts(p_ow_user_id uuid, p_field text, p_values text[])
 returns table(value text, companies integer)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select v, (
    select count(*)::int from ow_companies c
     where c.is_published = true and c.suspended_at is null and c.is_test is not true
       and not exists (select 1 from ow_approach_blocked_companies b where b.user_id = p_ow_user_id and b.company_id = c.id)
       and public.approach_company_matches_field(c.id, p_field, array[v])
  )
  from unnest(p_values) as v;
$function$;

create or replace function public.approach_range_field_coverage()
 returns table(field text, enabled boolean, with_clue integer, total integer)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with base as (
    select c.* from ow_companies c where c.is_published = true and c.suspended_at is null and c.is_test is not true
  ),
  clue as (
    select 'job_categories'::text as field, count(*) filter (where exists (
             select 1 from ow_job_roles jr join ow_jobs j on j.id = jr.job_id
              where j.company_id = b.id and j.status = 'published' and j.is_test = false
             union all
             select 1 from ow_company_job_roles r
              where r.company_id = b.id and r.deleted_at is null and r.standard_role_id is not null))::int as n from base b
    union all select 'industries',  count(*) filter (where b.industry_id is not null)::int from base b
    union all select 'size_groups', count(*) filter (where b.employee_count_band is not null)::int from base b
    union all select 'prefectures', count(*) filter (where b.location is not null or coalesce(array_length(b.branch_locations, 1), 0) > 0)::int from base b
    union all select 'remote_ok',   count(*) filter (where b.remote_work_status is not null)::int from base b
  )
  select clue.field, coalesce(f.enabled, false), clue.n, (select count(*)::int from base)
    from clue left join ow_approach_range_fields f on f.field = clue.field;
$function$;

-- ── 検算: 表示が変わっていないこと ────────────────────────────────────────
do $$
declare b record;
begin
  select * into b from _before;
  if (select count(*) from ow_companies where suspended_at is not null) <> 0 then
    raise exception '停止中の会社が生まれている';
  end if;
  if (select count(*) from ow_jobs where company_suspended) <> 0 then
    raise exception 'company_suspended = true の募集が生まれている';
  end if;
  if (select count(*) from ow_companies where is_published = true and is_test = false) <> b.co_published
     or (select count(*) from ow_companies where is_published = true and listing_status = 'listed' and is_test = false) <> b.co_listed
     or (select count(*) from ow_jobs where status = 'published' and is_test = false and company_suspended = false) <> b.jobs_published then
    raise exception '公開中の件数が変わった';
  end if;
  if has_column_privilege('authenticated', 'public.ow_companies', 'suspended_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.ow_companies', 'suspension_reason', 'UPDATE') then
    raise exception '停止の列に authenticated の UPDATE が付いている';
  end if;
  /* ★RLS の式は実行者の権限で評価される。anon が新しい列を読めないと、公開の判定ごと 401 になる */
  if not has_column_privilege('anon', 'public.ow_companies', 'suspended_at', 'SELECT')
     or not has_column_privilege('anon', 'public.ow_jobs', 'company_suspended', 'SELECT') then
    raise exception 'anon が公開の判定に使う列を読めない（RLS が評価できなくなる）';
  end if;
  if has_table_privilege('authenticated', 'public.ow_moderation_actions', 'SELECT')
     or has_table_privilege('anon', 'public.ow_moderation_actions', 'SELECT') then
    raise exception '履歴の表に anon / authenticated の権限が付いている';
  end if;
end $$;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- 戻し方（停止中の会社が無いことを確かめてから）
--   drop policy ow_jobs_published_read on ow_jobs;
--   create policy ow_jobs_published_read on ow_jobs for select using ((status = 'published') and (is_test = false));
--   drop policy ow_companies_published_read on ow_companies;
--   create policy ow_companies_published_read on ow_companies for select using ((is_published = true) and ((is_test = false) or auth_is_test_user()));
--   3つの関数は suspended_at の行を外した本文で CREATE OR REPLACE
--   drop trigger trg_ow_companies_propagate_suspension on ow_companies; drop function propagate_company_suspension_to_jobs();
--   drop trigger trg_ow_jobs_company_suspended on ow_jobs;             drop function sync_job_company_suspended();
--   drop table ow_moderation_actions;
--   alter table ow_jobs drop column company_suspended;
--   alter table ow_companies drop constraint ow_companies_suspension_consistency, drop column suspended_at, ...（6列）;
-- ════════════════════════════════════════════════════════════════════════════
