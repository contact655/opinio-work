-- ════════════════════════════════════════════════════════════════════════
-- 声かけを受け取る範囲 —— リモートが未登録の企業を「合う」と判定していた件（2026-10-10）
-- ════════════════════════════════════════════════════════════════════════
--
-- 20261010040000 の approach_company_matches_field() は、リモートの判定を
-- `c.remote_work_status in (...)` で返していた。未登録（null）の企業では null が返り、
-- company_in_approach_range() の `not ...` が null になって「合わない」で止まらなかった。
-- （項目を一時的に有効にした検証で発覚。リモートは無効のままなので、本番の判定には影響していない）
-- ⚠️ 引数は変えていないので CREATE OR REPLACE（権限は保たれる）。呼び出し側にも coalesce を入れて二重にした。
-- ════════════════════════════════════════════════════════════════════════

begin;

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
    -- ⚠️ 未登録（null）は合わない。`in` だけだと null を返し、呼び出し側の `not` が効かずに素通りする
    return coalesce(c.remote_work_status in ('full_remote', 'hybrid'), false);
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
    if coalesce(array_length(v, 1), 0) > 0 and not coalesce(public.approach_company_matches_field(p_company_id, f, v), false) then
      return false;
    end if;
  end loop;
  return true;
end;
$function$;


do $$
begin
  if has_function_privilege('authenticated', 'public.approach_company_matches_field(uuid, text, text[])', 'EXECUTE') then
    raise exception '検算失敗: クライアントから呼べる';
  end if;
  raise notice '検算OK: リモート未登録は合わない';
end $$;

commit;
