-- ★企業ページの3項目を足す（2026-11-27 / 柴さんの指示。企業詳細の作り直しのフェーズ3）
--   ① 資本金        ow_companies.capital_amount_yen（bigint・円）
--   ② 代表メッセージ ow_companies.ceo_message（text・2000字まで）
--   ③ これまでの歩み ow_company_milestones（新しい表）
--
-- ⚠️ データは1行も入れない（運営がまとめて入れることはしない。企業が /biz/company から、運営が /admin から入れる）。
-- ⚠️ 追加だけ。既存の列・行は変えない（古いコードはこの列と表を知らないだけで壊れない）。
--
-- ■ 資本金を数値（円）にした理由
--   2026-11-26 時点で資本金を持つ列は無く、データも0件。表記ゆれ（「1億円」「100,000,000円」）を作らず、
--   表示は画面側で「1億2,000万円」の形にそろえる。
--
-- ■ ow_companies の権限
--   SELECT は anon / authenticated ともテーブル単位なので、新しい列も読める（適用後に確かめる）。
--   UPDATE は列単位で配っているので、authenticated に2列を付与する（/biz の「変更を公開する」が企業のセッションで書くため）。
--
-- ■ ow_company_milestones の RLS は ow_company_business_domains と同じ形
--   読む: 公開中かつ検証用でない会社の行は誰でも／その会社の担当者／運営
--   書く: その会社の管理者（auth_company_can(company_id, 'admin')）／運営
--
-- 戻し方:
--   drop table if exists public.ow_company_milestones;
--   alter table public.ow_companies drop column if exists capital_amount_yen, drop column if exists ceo_message;

-- ── ①② ow_companies に2列 ─────────────────────────────────────────────
alter table public.ow_companies
  add column if not exists capital_amount_yen bigint
    constraint ow_companies_capital_amount_yen_check check (capital_amount_yen is null or capital_amount_yen >= 0),
  add column if not exists ceo_message text
    constraint ow_companies_ceo_message_check check (ceo_message is null or char_length(ceo_message) <= 2000);

comment on column public.ow_companies.capital_amount_yen is '資本金（円）。企業が /biz/company、運営が /admin から入れる。表示は画面で「1億2,000万円」の形にする（2026-11-27）';
comment on column public.ow_companies.ceo_message is '代表メッセージ。企業が自分で書く文章（2000字まで）。運営が文章を作らない（2026-11-27）';

grant update (capital_amount_yen, ceo_message) on public.ow_companies to authenticated;

-- ── ③ これまでの歩み ──────────────────────────────────────────────────
create table if not exists public.ow_company_milestones (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.ow_companies(id) on delete cascade,
  year        integer not null constraint ow_company_milestones_year_check check (year between 1800 and 2100),
  month       smallint constraint ow_company_milestones_month_check check (month is null or month between 1 and 12),
  event       text not null constraint ow_company_milestones_event_check check (char_length(btrim(event)) between 1 and 200),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.ow_company_milestones is 'これまでの歩み（年・月（任意）・出来事）。企業ページで年月順に縦に並べる。企業が /biz/company、運営が /admin から入れる（2026-11-27）';

create index if not exists ow_company_milestones_company_idx on public.ow_company_milestones (company_id, year, month, sort_order);

alter table public.ow_company_milestones enable row level security;

create policy company_milestones_anon_read on public.ow_company_milestones
  for select to anon
  using (exists (select 1 from public.ow_companies c
                  where c.id = ow_company_milestones.company_id and c.is_published = true and c.is_test = false));

create policy company_milestones_auth_read on public.ow_company_milestones
  for select to authenticated
  using ((exists (select 1 from public.ow_companies c
                   where c.id = ow_company_milestones.company_id and c.is_published = true and c.is_test = false))
         or public.auth_company_can(company_id, 'member'::text) or public.auth_is_admin());

create policy company_milestones_write_insert on public.ow_company_milestones
  for insert to authenticated
  with check (public.auth_company_can(company_id, 'admin'::text) or public.auth_is_admin());

create policy company_milestones_write_update on public.ow_company_milestones
  for update to authenticated
  using (public.auth_company_can(company_id, 'admin'::text) or public.auth_is_admin())
  with check (public.auth_company_can(company_id, 'admin'::text) or public.auth_is_admin());

create policy company_milestones_write_delete on public.ow_company_milestones
  for delete to authenticated
  using (public.auth_company_can(company_id, 'admin'::text) or public.auth_is_admin());

grant select on public.ow_company_milestones to anon;
grant select, insert, update, delete on public.ow_company_milestones to authenticated;
grant all on public.ow_company_milestones to service_role;

-- ── 検算（想定と違えば中止） ──────────────────────────────────────────
do $$
begin
  if not has_column_privilege('authenticated', 'public.ow_companies', 'capital_amount_yen', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.ow_companies', 'ceo_message', 'UPDATE') then
    raise exception '検算: authenticated に新しい2列の UPDATE が無い';
  end if;
  if not has_column_privilege('anon', 'public.ow_companies', 'ceo_message', 'SELECT')
     or not has_column_privilege('anon', 'public.ow_companies', 'capital_amount_yen', 'SELECT') then
    raise exception '検算: anon が新しい2列を読めない';
  end if;
  if has_table_privilege('anon', 'public.ow_company_milestones', 'INSERT') then
    raise exception '検算: anon が ow_company_milestones に書ける';
  end if;
  if (select count(*) from public.ow_company_milestones) <> 0 then
    raise exception '検算: ow_company_milestones に行がある（データは入れない決まり）';
  end if;
end $$;
