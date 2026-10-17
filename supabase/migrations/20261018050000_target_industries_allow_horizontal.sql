-- ★「業界を問わない（horizontal）」会社にも、主な顧客の業界を入れられるようにする（2026-10-18 / 柴さんの判断 A）
--
-- それまで顧客の業界（ow_company_target_industries）を持てるのは「特定の業界に張っている（vertical）」会社だけで、
-- 業界を問わない71社は1件も持てなかった。そのため製造業・小売など多くの業界に売っている会社でも、
-- 候補者の「合うところ」に業界の一致が一度も出なかった（製造業出身者を製造業に売る SaaS と結べない）。
--
-- 変えるもの（スキーマと関数だけ。行のデータは変えない）:
--   ① 明細の CHECK: scope = 'vertical' だけ → 'vertical' か 'horizontal'
--      ⚠️ consumer（消費者向け）と未確認（NULL）は今までどおり明細を持てない
--   ② 複合FK を ON UPDATE CASCADE に（vertical と horizontal を切り替えても明細が付いていく）。
--      consumer / NULL へ切り替えると ① の CHECK で落ちる（RPC は先に明細を消すので通る）
--   ③ RPC set_company_target_industries:
--      horizontal は 0〜3件（入れなくてもよい）／vertical は今までどおり1件以上／consumer・NULL は0件。
--      明細の scope 列に p_scope を書く（それまでは列の既定値 'vertical' に頼っていた）
--      ⚠️ CREATE OR REPLACE（引数を変えないので権限はそのまま。service_role だけが呼べる）
--
-- 作業前の状態（2026-10-18 実測）: 明細 10行（すべて vertical の会社）／ horizontal 71社・vertical 10社・consumer 2社・未確認 32社（検証用を除く）
-- 戻し方: 末尾のコメント
-- ⚠️ 読む側の変更（「経験が活きる会社」は vertical だけ・自社と同じ業界の一致は数えない）はコードで行う

begin;

-- 作業前の件数を控える
create temp table _before on commit drop as
  select (select count(*) from public.ow_company_target_industries) as rows_cti,
         (select count(*) from public.ow_company_target_industries where target_industry_scope <> 'vertical') as non_vertical;

do $$
begin
  if (select non_vertical from _before) <> 0 then
    raise exception 'vertical 以外の明細が既にある。想定と違うので中止する';
  end if;
end $$;

-- ① CHECK を広げる
alter table public.ow_company_target_industries drop constraint ow_cti_scope_is_vertical;
alter table public.ow_company_target_industries
  add constraint ow_cti_scope_has_items check (target_industry_scope in ('vertical', 'horizontal'));

-- ② 複合FK を ON UPDATE CASCADE に張り替える
alter table public.ow_company_target_industries drop constraint ow_cti_company_scope_fkey;
alter table public.ow_company_target_industries
  add constraint ow_cti_company_scope_fkey
  foreign key (company_id, target_industry_scope)
  references public.ow_companies (id, target_industry_scope)
  on update cascade on delete cascade;

-- ③ RPC
create or replace function public.set_company_target_industries(
  p_company_id uuid, p_scope text, p_industry_ids uuid[], p_primary_industry_id uuid)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_ids   uuid[];
  v_count integer;
  v_valid integer;
begin
  if not exists (select 1 from ow_companies where id = p_company_id) then
    raise exception '企業が見つかりません' using errcode = '22023';
  end if;

  if p_scope is not null and p_scope not in ('vertical', 'horizontal', 'consumer') then
    raise exception '対象業界の状態は vertical / horizontal / consumer / NULL のいずれかです'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct d), '{}'::uuid[])
    into v_ids
    from unnest(coalesce(p_industry_ids, '{}'::uuid[])) as d;
  v_count := coalesce(array_length(v_ids, 1), 0);

  -- ★horizontal も明細を持てる（主な顧客の業界。0件でもよい）。consumer・未確認は持てない
  if p_scope is distinct from 'vertical' and p_scope is distinct from 'horizontal' and v_count > 0 then
    raise exception '「消費者向け」「未確認」のときは顧客の業界を指定できません'
      using errcode = '22023';
  end if;

  if p_scope = 'vertical' and v_count = 0 then
    raise exception '「特定の業界に張っている」を選んだときは、対象業界を1つ以上選んでください'
      using errcode = '22023';
  end if;

  if v_count > 0 then
    select count(*) into v_valid
      from ow_industries where id = any(v_ids) and is_active = true;
    if v_valid <> v_count then
      raise exception '業種マスタに無い、または無効な id が含まれています'
        using errcode = '22023';
    end if;

    if p_primary_industry_id is null then
      raise exception '主の対象業界を1つ選んでください' using errcode = '22023';
    end if;
    if not (p_primary_industry_id = any(v_ids)) then
      raise exception '主の対象業界は、選んだ対象業界の中から指定してください'
        using errcode = '22023';
    end if;
  elsif p_primary_industry_id is not null then
    raise exception '対象業界が0件のときは主を指定できません' using errcode = '22023';
  end if;

  -- ⚠️★順序は固定（明細を消す → scope を書く → 明細を入れる）
  delete from ow_company_target_industries where company_id = p_company_id;
  update ow_companies set target_industry_scope = p_scope where id = p_company_id;

  if v_count > 0 then
    -- ★scope 列に p_scope を書く（既定値 'vertical' に頼らない。horizontal の明細のため）
    insert into ow_company_target_industries (company_id, industry_id, is_primary, display_order, target_industry_scope)
    select p_company_id, m.id, (m.id = p_primary_industry_id),
           row_number() over (order by (m.id = p_primary_industry_id) desc, m.display_order, m.name),
           p_scope
      from ow_industries m where m.id = any(v_ids);
  end if;

  return v_count;
end $function$;

-- 検算: 行は1つも変わっていない・権限はそのまま（service_role だけ）
do $$
begin
  if (select count(*) from public.ow_company_target_industries) <> (select rows_cti from _before) then
    raise exception '明細の行数が変わった。ロールバック';
  end if;
  if has_function_privilege('anon', 'public.set_company_target_industries(uuid, text, uuid[], uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.set_company_target_industries(uuid, text, uuid[], uuid)', 'EXECUTE') then
    raise exception 'RPC の権限が広がっている。ロールバック';
  end if;
end $$;

commit;

-- ── 戻し方（horizontal の明細を先に消してから）────────────────────────────
-- delete from public.ow_company_target_industries where target_industry_scope = 'horizontal';
-- alter table public.ow_company_target_industries drop constraint ow_cti_scope_has_items;
-- alter table public.ow_company_target_industries add constraint ow_cti_scope_is_vertical check (target_industry_scope = 'vertical');
-- alter table public.ow_company_target_industries drop constraint ow_cti_company_scope_fkey;
-- alter table public.ow_company_target_industries add constraint ow_cti_company_scope_fkey
--   foreign key (company_id, target_industry_scope) references public.ow_companies (id, target_industry_scope) on update restrict on delete cascade;
-- （RPC は .dumps/20261018-0256-set_company_target_industries.before.sql の定義に戻す）
