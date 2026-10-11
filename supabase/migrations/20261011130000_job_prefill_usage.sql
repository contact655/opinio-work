-- ★求人票の貼り付けから下書きを作る機能（段階3）の利用回数（2026-10-11 / 柴さんの指示）
--
-- 追加だけ。既存の行・列・権限は変えない。
--
-- ⚠️★**貼り付けた文章は保存しない。** ここに持つのは「企業・日付（日本時間）・回数・おおよそのトークン数」だけ。
-- ⚠️ 1企業1日の上限は src/lib/jobs/prefill.ts の JOB_PREFILL_DAILY_LIMIT（20回）。ここでは縛らない（関数に渡す）。
-- ⚠️ 運営専用（ow_transitions と同じ形）。RLS 有効・ポリシー0本・anon / authenticated に GRANT しない。
--    読み書きはサーバーの admin クライアントから、下の2つの関数だけ（SECURITY INVOKER・service_role だけが実行できる）。

create table if not exists public.ow_job_prefill_usage (
  company_id uuid not null references public.ow_companies(id) on delete cascade,
  used_on date not null,
  used_count integer not null default 0 check (used_count >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  primary key (company_id, used_on)
);

comment on table public.ow_job_prefill_usage is
  '求人票の貼り付けから下書きを作った回数とおおよそのトークン数（企業×日本時間の日付）。貼り付けた文章は保存しない。運営専用';

alter table public.ow_job_prefill_usage enable row level security;
revoke all on table public.ow_job_prefill_usage from public, anon, authenticated;
grant select, insert, update, delete on table public.ow_job_prefill_usage to service_role;

-- ① 1回ぶんを確保する。上限に達していれば null を返す（確保しない）。同時に押されても上限を超えない。
create or replace function public.reserve_job_prefill(p_company_id uuid, p_day date, p_limit integer)
returns integer
language sql
security invoker
set search_path = public
as $$
  insert into public.ow_job_prefill_usage as u (company_id, used_on, used_count)
  values (p_company_id, p_day, 1)
  on conflict (company_id, used_on) do update
    set used_count = u.used_count + 1
    where u.used_count < p_limit
  returning used_count;
$$;

-- ② 使ったトークン数を足す
create or replace function public.add_job_prefill_tokens(p_company_id uuid, p_day date, p_input bigint, p_output bigint)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.ow_job_prefill_usage
     set input_tokens = input_tokens + greatest(p_input, 0),
         output_tokens = output_tokens + greatest(p_output, 0)
   where company_id = p_company_id and used_on = p_day;
$$;

revoke execute on function public.reserve_job_prefill(uuid, date, integer) from public, anon, authenticated;
revoke execute on function public.add_job_prefill_tokens(uuid, date, bigint, bigint) from public, anon, authenticated;
grant execute on function public.reserve_job_prefill(uuid, date, integer) to service_role;
grant execute on function public.add_job_prefill_tokens(uuid, date, bigint, bigint) to service_role;

do $$
begin
  if has_table_privilege('authenticated', 'public.ow_job_prefill_usage', 'SELECT')
     or has_table_privilege('anon', 'public.ow_job_prefill_usage', 'SELECT') then
    raise exception 'ow_job_prefill_usage が anon / authenticated から読める';
  end if;
  if has_function_privilege('authenticated', 'public.reserve_job_prefill(uuid, date, integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.reserve_job_prefill(uuid, date, integer)', 'EXECUTE') then
    raise exception 'reserve_job_prefill が anon / authenticated から呼べる';
  end if;
end $$;
