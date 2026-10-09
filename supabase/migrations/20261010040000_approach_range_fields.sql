-- ════════════════════════════════════════════════════════════════════════
-- 声かけを受け取る範囲 —— 項目ごとの有効フラグ（2026-10-10 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★企業側のデータが揃っていない項目は、設定画面に出さず、判定にも使わない。
--   切り替えは**割合ではなく、この表のフラグ**で行う（割合で自動に切り替わると、企業1社の登録で
--   求職者の受け取り範囲が急に変わるため）。割合は approach_range_field_coverage() と
--   /admin/approach-range で見て、50% を超えたら運営が有効にする。
--
-- ★初期値（2026-10-10 実測 / 公開中・検証用を除く 116社）
--   職種       1社（  1%） → 無効
--   業種     114社（ 98%） → 有効
--   会社規模   84社（ 72%） → 有効
--   勤務地     84社（ 72%） → 有効
--   リモート     2社（  2%） → 無効
--
-- ★判定は1か所のまま。項目ごとの「合うか」を approach_company_matches_field() に切り出し、
--   company_in_approach_range()（判定）と approach_range_option_counts()（選択肢ごとの社数）が同じ関数を使う。
--   ⚠️ 無効の項目は、本人が値を入れていても判定に使わない（画面に出ない項目で絞られないように）。
--   ⚠️ 表・列・API は残す（表示だけの切り替え）。
-- ════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.ow_approach_range_fields (
  field text primary key check (field in ('job_categories','industries','size_groups','prefectures','remote_ok')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
comment on table public.ow_approach_range_fields is
  E'声かけを受け取る範囲の項目ごとの有効フラグ（2026-10-10）。無効の項目は設定画面に出さず、判定にも使わない。\n割合で自動に切り替えない（企業1社の登録で範囲が急に変わるため）。運営が /admin/approach-range で切り替える。';

alter table public.ow_approach_range_fields enable row level security;
-- ⚠️ ポリシー0本・クライアントに GRANT なし（運営の admin クライアントだけが読み書きする）
revoke all on public.ow_approach_range_fields from anon, authenticated;

insert into public.ow_approach_range_fields (field, enabled) values
  ('job_categories', false),
  ('industries',     true),
  ('size_groups',    true),
  ('prefectures',    true),
  ('remote_ok',      false)
on conflict (field) do nothing;

-- ── 1. 項目ごとに「合うか」（判定と選択肢ごとの社数が同じ関数を使う）──────────────
--   p_values: 職種・業種は uuid の文字列、規模はまとまりの値、勤務地は都道府県名、リモートは array['true']
create or replace function public.approach_company_matches_field(p_company_id uuid, p_field text, p_values text[])
returns boolean
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  c record;
  v_ids uuid[];
  v_bands text[];
begin
  if coalesce(array_length(p_values, 1), 0) = 0 then return true; end if;
  select id, industry_id, employee_count_band, location, branch_locations, remote_work_status
    into c from ow_companies where id = p_company_id;
  if not found then return false; end if;

  if p_field = 'job_categories' then
    v_ids := p_values::uuid[];
    return exists (
      with company_roles as (
        select jr.role_id as rid
          from ow_job_roles jr join ow_jobs j on j.id = jr.job_id
         where j.company_id = p_company_id and j.status = 'published' and j.is_test = false
        union
        select r.standard_role_id from ow_company_job_roles r
         where r.company_id = p_company_id and r.deleted_at is null and r.standard_role_id is not null
      )
      select 1 from company_roles cr join ow_roles cro on cro.id = cr.rid
       where cr.rid = any(v_ids) or cro.parent_id = any(v_ids)
          or exists (select 1 from ow_roles pr where pr.id = any(v_ids) and pr.parent_id = cr.rid)
    );
  elsif p_field = 'industries' then
    v_ids := p_values::uuid[];
    if c.industry_id is null then return false; end if;
    return c.industry_id = any(v_ids)
        or exists (select 1 from ow_industries i where i.id = c.industry_id and i.parent_id = any(v_ids));
  elsif p_field = 'size_groups' then
    -- ⚠️ TS の COMPANY_SIZE_GROUPS と同じ対応
    if c.employee_count_band is null then return false; end if;
    select array_agg(b) into v_bands from (
      select unnest(case g
        when '1-50'     then array['1-10','11-50']
        when '51-500'   then array['51-200','201-500']
        when '501-5000' then array['501-1000','1001-5000']
        when '5001-'    then array['5001-10000','10001+']
      end) as b
      from unnest(p_values) as g
    ) s;
    return c.employee_count_band = any(coalesce(v_bands, array[]::text[]));
  elsif p_field = 'prefectures' then
    return exists (
      select 1 from unnest(p_values) as pref
       where (c.location is not null and c.location like '%' || pref || '%')
          or exists (
            select 1 from unnest(coalesce(c.branch_locations, array[]::text[])) as br
             where length(br) > 0 and (pref like br || '%' or (br = '名古屋' and pref = '愛知県'))
          )
    );
  elsif p_field = 'remote_ok' then
    return c.remote_work_status in ('full_remote', 'hybrid');
  end if;
  raise exception 'unknown field: %', p_field;
end;
$function$;

-- ── 2. 範囲に合うか（有効な項目だけを見る）───────────────────────────────────
create or replace function public.company_in_approach_range(p_company_id uuid, p_ow_user_id uuid)
returns boolean
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  p ow_approach_preferences%rowtype;
  f text;
  v text[];
begin
  select * into p from ow_approach_preferences where user_id = p_ow_user_id;
  if not found then return true; end if;  -- 範囲を何も決めていない＝こだわらない
  if not exists (select 1 from ow_companies where id = p_company_id) then return false; end if;

  -- ★無効の項目は見ない（行が無い項目も無効の扱い）
  for f in select field from ow_approach_range_fields where enabled loop
    v := case f
      when 'job_categories' then p.job_categories::text[]
      when 'industries'     then p.industries::text[]
      when 'size_groups'    then p.size_groups
      when 'prefectures'    then p.prefectures
      when 'remote_ok'      then case when p.remote_ok is true then array['true'] else array[]::text[] end
    end;
    if coalesce(array_length(v, 1), 0) > 0 and not public.approach_company_matches_field(p_company_id, f, v) then
      return false;
    end if;
  end loop;
  return true;
end;
$function$;

-- ── 3. 選択肢ごとの社数（その選択肢だけを選んだとき。公開中・検証用を除く・受け取らない企業を除く）────
create or replace function public.approach_range_option_counts(p_ow_user_id uuid, p_field text, p_values text[])
returns table(value text, companies integer)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select v, (
    select count(*)::int from ow_companies c
     where c.is_published = true and c.is_test is not true
       and not exists (select 1 from ow_approach_blocked_companies b where b.user_id = p_ow_user_id and b.company_id = c.id)
       and public.approach_company_matches_field(c.id, p_field, array[v])
  )
  from unnest(p_values) as v;
$function$;

-- ── 4. 項目ごとの割合（運営が有効にするかを決める材料）────────────────────────
--   手がかり = その項目で「合う／合わない」を判定できる値を企業が持っていること
create or replace function public.approach_range_field_coverage()
returns table(field text, enabled boolean, with_clue integer, total integer)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  with base as (
    select c.* from ow_companies c where c.is_published = true and c.is_test is not true
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

-- ★権限: サーバー（service_role）だけ
revoke execute on function public.approach_company_matches_field(uuid, text, text[]) from public, anon, authenticated;
revoke execute on function public.approach_range_option_counts(uuid, text, text[]) from public, anon, authenticated;
revoke execute on function public.approach_range_field_coverage() from public, anon, authenticated;
grant execute on function public.approach_company_matches_field(uuid, text, text[]) to service_role;
grant execute on function public.approach_range_option_counts(uuid, text, text[]) to service_role;
grant execute on function public.approach_range_field_coverage() to service_role;

-- ── 検算 ──────────────────────────────────────────────────────────────────
do $$
declare v_job int; v_remote int; v_users int;
begin
  if has_function_privilege('authenticated', 'public.approach_range_option_counts(uuid, text, text[])', 'EXECUTE')
     or has_function_privilege('anon', 'public.approach_company_matches_field(uuid, text, text[])', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.approach_range_field_coverage()', 'EXECUTE')
     or has_table_privilege('authenticated', 'public.ow_approach_range_fields', 'SELECT') then
    raise exception '検算失敗: クライアントから呼べる／読める';
  end if;
  select with_clue into v_job from public.approach_range_field_coverage() where field = 'job_categories';
  select with_clue into v_remote from public.approach_range_field_coverage() where field = 'remote_ok';
  -- 無効にした項目に値を入れている人（判定には使われない）
  select count(*) into v_users from ow_approach_preferences
   where coalesce(array_length(job_categories, 1), 0) > 0 or remote_ok is true;
  raise notice '検算OK: 職種の手がかり % 社 / リモート % 社 / 無効の項目に値を入れている人 % 人', v_job, v_remote, v_users;
end $$;

commit;

-- ★戻すとき: 20261010030000 の company_in_approach_range を当て直し、
--   drop function public.approach_range_field_coverage(); drop function public.approach_range_option_counts(uuid, text, text[]);
--   drop function public.approach_company_matches_field(uuid, text, text[]); drop table public.ow_approach_range_fields;
