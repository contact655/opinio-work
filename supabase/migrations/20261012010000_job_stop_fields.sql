-- ★運営による求人の停止を記録する列（2026-10-12 / 柴さんの指示。即時公開に切り替え、運営は公開後に巡回して停止する）。
--   stopped_reason … 停止の理由（企業にメールとアプリ内で知らせる）
--   stopped_at     … 停止した日時。⚠️ 状態は status = 'private' と組み合わせて「停止中」と読む
--   stopped_by     … 停止した運営（ow_users 空間）
-- ⚠️ rejection_reason（差し戻し）は流用しない（柴さんの判断）。
-- ⚠️ 既存の行は変えない（全行 NULL で生まれる）。実在の求人の状態にも触らない。
-- ⚠️ guard_job_status_transition（企業は published / rejected を書けない）と
--    RLS ow_jobs_company_admin_insert（企業は draft / pending_review でしか作れない）は変えない。
--    公開はアプリの API が判定してから admin クライアントで書く。

alter table public.ow_jobs
  add column stopped_reason text,
  add column stopped_at timestamptz,
  add column stopped_by uuid references public.ow_users(id) on delete set null;

comment on column public.ow_jobs.stopped_reason is '運営が停止した理由（企業に通知する）。2026-10-12';
comment on column public.ow_jobs.stopped_at is '運営が停止した日時。status = private と組み合わせて「停止中」。運営が戻すと NULL に戻る。2026-10-12';
comment on column public.ow_jobs.stopped_by is '停止した運営（ow_users.id）。2026-10-12';

-- ★企業が停止の記録を書き換えられないようにする。
--   ⚠️ ow_jobs の UPDATE は企業の管理者にテーブル単位で開いている（RLS ow_jobs_company_admin_update）。
--      これが無いと、企業が PostgREST から stopped_at を消して、運営確認を経ずに再公開できてしまう。
--   ⚠️ 運営の経路（service_role / auth_is_admin）はそのまま通す（guard_job_status_transition と同じ形）。
create or replace function public.guard_job_stop_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'service_role' or public.auth_is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.stopped_reason is not null or new.stopped_at is not null or new.stopped_by is not null then
      raise exception '停止の記録は運営だけが書けます' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.stopped_reason is distinct from old.stopped_reason
     or new.stopped_at is distinct from old.stopped_at
     or new.stopped_by is distinct from old.stopped_by then
    raise exception '停止の記録は運営だけが書けます' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger trg_guard_job_stop_fields
  before insert or update on public.ow_jobs
  for each row execute function public.guard_job_stop_fields();

-- 検算: 既存の行は全部 NULL のまま
do $$
declare n int;
begin
  select count(*) into n from public.ow_jobs where stopped_reason is not null or stopped_at is not null or stopped_by is not null;
  if n <> 0 then raise exception '想定外: 停止の記録がある行 %', n; end if;
end $$;
