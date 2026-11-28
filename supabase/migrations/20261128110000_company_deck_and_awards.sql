-- ★企業ページに「会社紹介資料」と「受賞・認定」を足す（2026-11-28 / 柴さんの指示。PR1）
--   ① ow_company_external_links.type に 'deck'（会社紹介資料）を足す（CHECK の張り替え）
--   ② ow_company_external_links の公開の読み取りに「会社が公開中で、検証用でない」を足す（ow_company_milestones と同じ形）
--   ③ 受賞・認定 ow_company_awards（新しい表）
--
-- ⚠️ データは1行も入れない（企業が /biz/company から入れる。運営が代わりに作らない）。
-- ⚠️ 種類の一覧は src/lib/constants/externalLinkTypes.ts と同じ。片方だけ変えない。
--    上限（名称・団体は100字、年は1900〜2100、url は https のみ）は src/lib/companies/awards.ts と同じ。
--
-- ■ ② で変わること（2026-11-28 時点の実データ: 5行・3社とも公開中の実在の会社 → 見えなくなる行は0件）
--   それまでの company_external_links_public_read は「is_published = true」だけで、
--   非公開・検証用の会社のリンクも anon から読めた。
--   会社の管理者と運営の読み書きは、既存の company_external_links_company_manage / _editor_manage（FOR ALL）のまま。
--
-- 戻し方:
--   drop table if exists public.ow_company_awards;
--   drop policy if exists company_external_links_anon_read on public.ow_company_external_links;
--   drop policy if exists company_external_links_auth_read on public.ow_company_external_links;
--   create policy company_external_links_public_read on public.ow_company_external_links for select using (is_published = true);
--   delete from public.ow_company_external_links where type = 'deck';   -- ⚠️ 入っていれば。消す前にダンプ
--   alter table public.ow_company_external_links drop constraint ow_company_external_links_type_check,
--     add constraint ow_company_external_links_type_check check (type = any (array['article','video','audio','social','event','other']));

begin;

-- ── ① type に deck ─────────────────────────────────────────────────────
alter table public.ow_company_external_links drop constraint ow_company_external_links_type_check;
alter table public.ow_company_external_links add constraint ow_company_external_links_type_check
  check (type = any (array['article'::text, 'video'::text, 'audio'::text, 'social'::text, 'event'::text, 'deck'::text, 'other'::text]));

-- ── ② 公開の読み取り ───────────────────────────────────────────────────
drop policy if exists company_external_links_public_read on public.ow_company_external_links;

create policy company_external_links_anon_read on public.ow_company_external_links
  for select to anon
  using (is_published = true
         and exists (select 1 from public.ow_companies c
                      where c.id = ow_company_external_links.company_id and c.is_published = true and c.is_test = false));

create policy company_external_links_auth_read on public.ow_company_external_links
  for select to authenticated
  using ((is_published = true
          and exists (select 1 from public.ow_companies c
                       where c.id = ow_company_external_links.company_id and c.is_published = true and c.is_test = false))
         or public.auth_company_can(company_id, 'member'::text) or public.auth_is_admin());

-- ── ③ 受賞・認定 ───────────────────────────────────────────────────────
create table if not exists public.ow_company_awards (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.ow_companies(id) on delete cascade,
  name        text not null constraint ow_company_awards_name_check check (char_length(btrim(name)) between 1 and 100),
  issuer      text not null constraint ow_company_awards_issuer_check check (char_length(btrim(issuer)) between 1 and 100),
  year        integer not null constraint ow_company_awards_year_check check (year between 1900 and 2100),
  url         text constraint ow_company_awards_url_check check (url is null or (url ~ '^https://' and char_length(url) <= 2000)),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.ow_company_awards is '受賞・認定（正式名称・主催/認定した団体・年・根拠のURL）。企業が /biz/company から入れる。運営が代わりに作らない。企業ページで新しい年から並べる（2026-11-28）';

create index if not exists ow_company_awards_company_idx on public.ow_company_awards (company_id, year desc, sort_order);

alter table public.ow_company_awards enable row level security;

create policy company_awards_anon_read on public.ow_company_awards
  for select to anon
  using (exists (select 1 from public.ow_companies c
                  where c.id = ow_company_awards.company_id and c.is_published = true and c.is_test = false));

create policy company_awards_auth_read on public.ow_company_awards
  for select to authenticated
  using ((exists (select 1 from public.ow_companies c
                   where c.id = ow_company_awards.company_id and c.is_published = true and c.is_test = false))
         or public.auth_company_can(company_id, 'member'::text) or public.auth_is_admin());

create policy company_awards_write_insert on public.ow_company_awards
  for insert to authenticated
  with check (public.auth_company_can(company_id, 'admin'::text) or public.auth_is_admin());

create policy company_awards_write_update on public.ow_company_awards
  for update to authenticated
  using (public.auth_company_can(company_id, 'admin'::text) or public.auth_is_admin())
  with check (public.auth_company_can(company_id, 'admin'::text) or public.auth_is_admin());

create policy company_awards_write_delete on public.ow_company_awards
  for delete to authenticated
  using (public.auth_company_can(company_id, 'admin'::text) or public.auth_is_admin());

grant select on public.ow_company_awards to anon;
grant select, insert, update, delete on public.ow_company_awards to authenticated;
grant all on public.ow_company_awards to service_role;

-- ── 検算（想定と違えば中止） ──────────────────────────────────────────
do $$
begin
  if has_table_privilege('anon', 'public.ow_company_awards', 'INSERT') then
    raise exception '検算: anon が ow_company_awards に書ける';
  end if;
  if (select count(*) from public.ow_company_awards) <> 0 then
    raise exception '検算: ow_company_awards に行がある（データは入れない決まり）';
  end if;
  if exists (select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
              where c.relname = 'ow_company_external_links' and p.polname = 'company_external_links_public_read') then
    raise exception '検算: 古い公開の読み取りポリシーが残っている';
  end if;
  if (select count(*) from public.ow_company_external_links where type = 'deck') <> 0 then
    raise exception '検算: deck の行がある（データは入れない決まり）';
  end if;
end $$;

commit;
