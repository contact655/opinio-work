-- ════════════════════════════════════════════════════════════════════════
-- 社内メモと候補者の社内の状態（2026-10-10 / 声かけまわり 段5）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★フラグで本番はオフ（CANDIDATE_NOTES_ENABLED。プライバシーポリシーを改定してからオンにする）。
--   表は先に作るが、オフのあいだは API が 404 を返し、画面にも出さない。
--
-- ★読み書きできるのは「その企業の担当者」だけ。
--   ⚠️ クライアントのロール（anon / authenticated）には GRANT しない ＝ PostgREST から直接は誰も読めない（42501）。
--      読み書きはサーバー（/api/biz/candidates/[id]/notes 等）が admin クライアントで行い、
--      呼び出した人がその企業の有効な担当者であることを確かめてから通す。
--   ⚠️ RLS も有効にし、担当者だけのポリシーを置く（将来 GRANT を足したときの二重の守り）。
--
-- ★消す時期
--   ・求職者が退会したら（ow_users の行が消えたら）両方の表から消える（on delete cascade）。
--   ・企業の契約が終わったら: 運営が「企業の退会」の操作をした日（ow_companies.withdrawn_at）から30日後に、
--     日次の処理（/api/cron/purge-candidate-notes）がその企業の分を消す。
--     ⚠️ 担当者が全員無効になっても自動では消さない（柴さんの判断）。
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 企業の退会の操作をした日 ───────────────────────────────────────────────
alter table public.ow_companies add column if not exists withdrawn_at timestamptz;
comment on column public.ow_companies.withdrawn_at is
  '運営が企業の退会の操作をした日時（2026-10-10）。この日から30日後に、その企業の社内メモと社内の状態を消す。⚠️ 運営だけが書く（authenticated に UPDATE を配らない）';

-- ── 社内メモ ─────────────────────────────────────────────────────────────
create table if not exists public.ow_candidate_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ow_companies(id) on delete cascade,
  candidate_user_id uuid not null references public.ow_users(id) on delete cascade,
  author_id uuid references public.ow_users(id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists ow_candidate_notes_company_candidate on public.ow_candidate_notes (company_id, candidate_user_id, created_at desc);
comment on table public.ow_candidate_notes is
  '企業の担当者が候補者について書く社内メモ（2026-10-10 / 段5）。その企業の担当者だけが読める。1000字まで。本人から開示を求められた場合は開示の対象になりうる';

-- ── 候補者の社内の状態と担当 ─────────────────────────────────────────────────
create table if not exists public.ow_candidate_tracking (
  company_id uuid not null references public.ow_companies(id) on delete cascade,
  candidate_user_id uuid not null references public.ow_users(id) on delete cascade,
  owner_id uuid references public.ow_users(id) on delete set null,
  stage text check (stage in ('interested', 'approached', 'meeting', 'screening', 'declined_internal')),
  updated_at timestamptz not null default now(),
  primary key (company_id, candidate_user_id)
);
comment on table public.ow_candidate_tracking is
  E'候補者の社内の状態と担当（2026-10-10 / 段5）。stage: interested（気になる）/ approached（声かけ済み）/ meeting（面談）/ screening（選考中）/ declined_internal（見送り・社内）。\n「気になる」はここの stage=interested。その企業の担当者だけが読める';

-- ── RLS と権限 ───────────────────────────────────────────────────────────
alter table public.ow_candidate_notes enable row level security;
alter table public.ow_candidate_tracking enable row level security;
drop policy if exists ow_candidate_notes_company_admin on public.ow_candidate_notes;
create policy ow_candidate_notes_company_admin on public.ow_candidate_notes
  for all to authenticated using (public.auth_is_company_admin(company_id)) with check (public.auth_is_company_admin(company_id));
drop policy if exists ow_candidate_tracking_company_admin on public.ow_candidate_tracking;
create policy ow_candidate_tracking_company_admin on public.ow_candidate_tracking
  for all to authenticated using (public.auth_is_company_admin(company_id)) with check (public.auth_is_company_admin(company_id));
revoke all on public.ow_candidate_notes from anon, authenticated;
revoke all on public.ow_candidate_tracking from anon, authenticated;

-- ── 企業の退会から30日後に消す（日次の処理が呼ぶ。service_role だけ）───────────────
create or replace function public.purge_withdrawn_company_candidate_notes()
returns table(notes integer, tracking integer)
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare n1 int; n2 int;
begin
  delete from public.ow_candidate_notes n using public.ow_companies c
   where c.id = n.company_id and c.withdrawn_at is not null and c.withdrawn_at <= now() - interval '30 days';
  get diagnostics n1 = row_count;
  delete from public.ow_candidate_tracking t using public.ow_companies c
   where c.id = t.company_id and c.withdrawn_at is not null and c.withdrawn_at <= now() - interval '30 days';
  get diagnostics n2 = row_count;
  return query select n1, n2;
end;
$function$;
revoke execute on function public.purge_withdrawn_company_candidate_notes() from public, anon, authenticated;
grant execute on function public.purge_withdrawn_company_candidate_notes() to service_role;

-- ── 検算 ──────────────────────────────────────────────────────────────────
do $$
begin
  if has_table_privilege('authenticated', 'public.ow_candidate_notes', 'SELECT')
     or has_table_privilege('anon', 'public.ow_candidate_notes', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_candidate_tracking', 'SELECT')
     or has_column_privilege('authenticated', 'public.ow_companies', 'withdrawn_at', 'UPDATE')
     or has_function_privilege('authenticated', 'public.purge_withdrawn_company_candidate_notes()', 'EXECUTE') then
    raise exception '検算失敗: クライアントのロールから読める・書ける・呼べる';
  end if;
  raise notice '検算OK: 社内メモ・社内の状態・企業の退会日・30日後に消す関数を足した';
end $$;

commit;

-- ★戻すとき:
--   drop function public.purge_withdrawn_company_candidate_notes();
--   drop table public.ow_candidate_tracking; drop table public.ow_candidate_notes;
--   alter table public.ow_companies drop column withdrawn_at;
