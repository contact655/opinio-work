-- ════════════════════════════════════════════════════════════════════════
-- 声かけを受け取る範囲（2026-10-10 / 声かけまわり 段2）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★足すだけ（古いコードのままでも壊れない）。
--
-- ★表（どちらも本人だけが読み書きできる。user_id は ow_users 空間）
--   ow_approach_preferences       … 範囲。空の項目（null / 空配列）は「こだわらない」
--   ow_approach_blocked_companies … 声かけを受け取らない企業。⚠️ ow_scout_blocks（ブロック中の企業）とは別物。
--                                   あちらは候補者検索・提案からも外す。こちらは声かけだけを止める。
--
-- ★判定関数（SECURITY DEFINER・service_role だけが呼べる。check-definer-grants.sh の許可リスト外のまま＝
--   クライアントのロールに付与しない）
--   company_in_approach_range(company, user)  … 範囲に合うか（範囲の判定はここだけ）
--   can_send_company_approach(company, candidate, sender) … 送れるか（声かけの判定はここだけ）
--       = can_send_scout() ＋ 声かけを受け取る（accept_company_approaches）＋ 範囲 ＋ 受け取らない企業
--         ＋ 送る担当者と相手の is_test の一致（sender を渡したとき）
--   count_companies_in_approach_range(user) … /mypage/settings の「この範囲で声かけを送れる企業：N社」
--
-- ★企業側の値が未登録のとき: 範囲を指定している項目では**届かない側**に倒す。範囲が空の項目は見ない。
--
-- ★照らし方（柴さんの判断 2026-10-10）
--   職種 … 「公開中の求人の職種」と「企業が登録した職種のうち職種マスタに紐づくもの」のどちらか1つでも合えば合致。
--          ⚠️ 親子は両方向に見る（範囲が親なら子の職種も合う／範囲が子なら親の職種も合う）。兄弟は合わない
--   業種 … 企業の業種（industry_id）か、その親が範囲に入っていれば合致
--   規模 … 企業の帯（employee_count_band）が範囲のまとまりに入っていれば合致。
--          ⚠️ まとまり→帯の対応は TS の COMPANY_SIZE_GROUPS（lib/constants/employeeBand.ts）と**同じ**。片方だけ変えない
--   勤務地 … 本社の所在地（location）に都道府県名を含む、または支社（branch_locations）がその都道府県
--          ⚠️ 支社→都道府県は「先頭一致」＋「名古屋→愛知県」。TS の BRANCH_TO_PREF と食い違ったら直すこと
--   リモート … remote_ok が true なら、企業の勤務形態が full_remote / hybrid のときだけ合致（未登録は届かない）
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. 表 ────────────────────────────────────────────────────────────────────
create table if not exists public.ow_approach_preferences (
  user_id uuid primary key references public.ow_users(id) on delete cascade,
  job_categories uuid[],
  industries uuid[],
  size_groups text[],
  prefectures text[],
  remote_ok boolean,
  updated_at timestamptz not null default now(),
  constraint ow_approach_preferences_size_groups_check
    check (size_groups is null or size_groups <@ array['1-50','51-500','501-5000','5001-']::text[]),
  constraint ow_approach_preferences_prefectures_check
    check (prefectures is null or prefectures <@ array[
      '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
      '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
      '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
      '熊本県','大分県','宮崎県','鹿児島県','沖縄県']::text[])
);

create table if not exists public.ow_approach_blocked_companies (
  user_id uuid not null references public.ow_users(id) on delete cascade,
  company_id uuid not null references public.ow_companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

alter table public.ow_approach_preferences enable row level security;
alter table public.ow_approach_blocked_companies enable row level security;
revoke all on public.ow_approach_preferences from anon, authenticated;
revoke all on public.ow_approach_blocked_companies from anon, authenticated;
grant select, insert, update, delete on public.ow_approach_preferences to authenticated;
grant select, insert, delete on public.ow_approach_blocked_companies to authenticated;
grant all on public.ow_approach_preferences, public.ow_approach_blocked_companies to service_role;

drop policy if exists ow_approach_preferences_own on public.ow_approach_preferences;
create policy ow_approach_preferences_own on public.ow_approach_preferences for all to authenticated
  using (user_id = public.auth_ow_user_id()) with check (user_id = public.auth_ow_user_id());
drop policy if exists ow_approach_blocked_companies_own on public.ow_approach_blocked_companies;
create policy ow_approach_blocked_companies_own on public.ow_approach_blocked_companies for all to authenticated
  using (user_id = public.auth_ow_user_id()) with check (user_id = public.auth_ow_user_id());

comment on table public.ow_approach_preferences is
  E'声かけを受け取る範囲（2026-10-10）。空の項目は「こだわらない」。本人だけが読み書きできる。\n判定は can_send_company_approach() / company_in_approach_range() の中だけで使う（送れる企業の判定にだけ使う）。';
comment on table public.ow_approach_blocked_companies is
  '声かけを受け取らない企業（2026-10-10）。⚠️ ow_scout_blocks（候補者検索・提案からも外す）とは別。本人だけが読み書きできる。';

-- ── 2. 範囲に合うか ──────────────────────────────────────────────────────────
create or replace function public.company_in_approach_range(p_company_id uuid, p_ow_user_id uuid)
returns boolean
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  p ow_approach_preferences%rowtype;
  c record;
  v_bands text[];
begin
  select * into p from ow_approach_preferences where user_id = p_ow_user_id;
  if not found then return true; end if;  -- 範囲を何も決めていない＝こだわらない

  select id, industry_id, employee_count_band, location, branch_locations, remote_work_status
    into c from ow_companies where id = p_company_id;
  if not found then return false; end if;

  -- 職種
  if coalesce(array_length(p.job_categories, 1), 0) > 0 then
    if not exists (
      with company_roles as (
        select jr.role_id as rid
          from ow_job_roles jr join ow_jobs j on j.id = jr.job_id
         where j.company_id = p_company_id and j.status = 'published' and j.is_test = false
        union
        select r.standard_role_id from ow_company_job_roles r
         where r.company_id = p_company_id and r.deleted_at is null and r.standard_role_id is not null
      )
      select 1
        from company_roles cr
        join ow_roles cro on cro.id = cr.rid
       where cr.rid = any(p.job_categories)
          or cro.parent_id = any(p.job_categories)
          or exists (select 1 from ow_roles pr where pr.id = any(p.job_categories) and pr.parent_id = cr.rid)
    ) then return false; end if;
  end if;

  -- 業種
  if coalesce(array_length(p.industries, 1), 0) > 0 then
    if c.industry_id is null then return false; end if;
    if not (c.industry_id = any(p.industries)
            or exists (select 1 from ow_industries i where i.id = c.industry_id and i.parent_id = any(p.industries))) then
      return false;
    end if;
  end if;

  -- 規模（まとまり→帯。⚠️ TS の COMPANY_SIZE_GROUPS と同じ対応）
  if coalesce(array_length(p.size_groups, 1), 0) > 0 then
    if c.employee_count_band is null then return false; end if;
    select array_agg(b) into v_bands from (
      select unnest(case g
        when '1-50'     then array['1-10','11-50']
        when '51-500'   then array['51-200','201-500']
        when '501-5000' then array['501-1000','1001-5000']
        when '5001-'    then array['5001-10000','10001+']
      end) as b
      from unnest(p.size_groups) as g
    ) s;
    if not (c.employee_count_band = any(coalesce(v_bands, array[]::text[]))) then return false; end if;
  end if;

  -- 勤務地（本社の所在地 or 支社）
  if coalesce(array_length(p.prefectures, 1), 0) > 0 then
    if not exists (
      select 1 from unnest(p.prefectures) as pref
       where (c.location is not null and c.location like '%' || pref || '%')
          or exists (
            select 1 from unnest(coalesce(c.branch_locations, array[]::text[])) as br
             where length(br) > 0 and (pref like br || '%' or (br = '名古屋' and pref = '愛知県'))
          )
    ) then return false; end if;
  end if;

  -- リモート
  if p.remote_ok is true then
    if c.remote_work_status is null or c.remote_work_status not in ('full_remote', 'hybrid') then
      return false;
    end if;
  end if;

  return true;
end;
$function$;

-- ── 3. 送れるか（声かけの判定はここだけ）───────────────────────────────────────
create or replace function public.can_send_company_approach(
  p_company_id uuid, p_candidate_ow_user_id uuid, p_sender_ow_user_id uuid default null)
returns boolean
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  cand record;
  v_sender_test boolean;
begin
  select id, auth_id, is_test, is_system into cand from ow_users where id = p_candidate_ow_user_id;
  if not found or cand.auth_id is null or cand.is_system is true then return false; end if;
  if p_sender_ow_user_id is not null then
    if p_sender_ow_user_id = p_candidate_ow_user_id then return false; end if;
    select is_test into v_sender_test from ow_users where id = p_sender_ow_user_id;
    if not found or (coalesce(v_sender_test, false) <> coalesce(cand.is_test, false)) then return false; end if;
  end if;
  -- 見せてよいか（転職意欲・在籍歴とグループ会社・ブロック・転職勧奨禁止・管理者本人・検証用の一致）
  if not coalesce(public.can_send_scout(p_company_id, cand.auth_id), false) then return false; end if;
  -- 声かけを受け取る（null はまだ選んでいない＝受け取らない扱い）
  if not exists (select 1 from ow_profiles where user_id = cand.auth_id and accept_company_approaches is true) then
    return false;
  end if;
  -- 受け取らない企業
  if exists (select 1 from ow_approach_blocked_companies where user_id = p_candidate_ow_user_id and company_id = p_company_id) then
    return false;
  end if;
  -- 範囲
  return public.company_in_approach_range(p_company_id, p_candidate_ow_user_id);
end;
$function$;

-- ── 4. 範囲に合う公開中の企業の数（/mypage/settings）───────────────────────────
create or replace function public.count_companies_in_approach_range(p_ow_user_id uuid)
returns integer
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select count(*)::int
    from ow_companies c
   where c.is_published = true
     and c.is_test is not true
     and not exists (select 1 from ow_approach_blocked_companies b where b.user_id = p_ow_user_id and b.company_id = c.id)
     and public.company_in_approach_range(c.id, p_ow_user_id);
$function$;

-- ★権限: サーバー（service_role）だけ。⚠️ クライアントのロールに付与しないこと（他人の範囲が引ける）
revoke execute on function public.company_in_approach_range(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_send_company_approach(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.count_companies_in_approach_range(uuid) from public, anon, authenticated;
grant execute on function public.company_in_approach_range(uuid, uuid) to service_role;
grant execute on function public.can_send_company_approach(uuid, uuid, uuid) to service_role;
grant execute on function public.count_companies_in_approach_range(uuid) to service_role;

comment on function public.can_send_company_approach(uuid, uuid, uuid) is
  E'声かけを送れるか（2026-10-10）。**声かけの判定はここだけ**（送信の API・候補者検索のボタン・/u/[id] のボタン・「声かけを受け取る方のみ」の絞り込み）。\n= can_send_scout() ＋ accept_company_approaches ＋ 受け取らない企業 ＋ 範囲（company_in_approach_range）＋ sender と相手の is_test の一致。\n⚠️ 承認するときの判定は can_send_scout() のまま（届いた後で範囲を変えても承認できるように）。service_role だけが呼べる。';

-- ── 検算 ──────────────────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('authenticated', 'public.can_send_company_approach(uuid, uuid, uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.company_in_approach_range(uuid, uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.count_companies_in_approach_range(uuid)', 'EXECUTE') then
    raise exception '検算失敗: 判定関数がクライアントから呼べる';
  end if;
  if has_table_privilege('anon', 'public.ow_approach_preferences', 'SELECT') then
    raise exception '検算失敗: anon が範囲を読める';
  end if;
  raise notice '検算OK: 範囲の表と判定関数を作った';
end $$;

commit;

-- ★戻すとき:
--   drop function public.count_companies_in_approach_range(uuid);
--   drop function public.can_send_company_approach(uuid, uuid, uuid);
--   drop function public.company_in_approach_range(uuid, uuid);
--   drop table public.ow_approach_blocked_companies;
--   drop table public.ow_approach_preferences;
