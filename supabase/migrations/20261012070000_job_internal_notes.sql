-- ★求人の社内メモ（2026-10-12 / 柴さんの指示）。求人ごとに1件。**求職者には一切出さない。**
--   求人本体（ow_jobs）とは別の表にする。ow_jobs は求職者側の API・求人ページ・検索・構造化データが読むので、
--   同じ表に置くと select の書き方1つで外へ出うる。別の表なら、求職者側のコードはこの表を一度も読まない。
--   ⚠️ 禁止表現チェック・公開の必須項目（publishRequirements）・文言チェックは ow_jobs の列だけを見るので、対象外になる。
--
--   読み書きできるのは、その会社の現役の担当者（ow_company_admins.is_active）だけ（RLS）。anon には何も配らない。
--   本文は 2,000字まで（CHECK。画面と API も同じ定数 JOB_INTERNAL_NOTE_MAX）。
--   ⚠️ company_id は求人の会社と必ず一致させる（WITH CHECK で ow_jobs を見る）。他社の求人にメモを付けられないように。

create table public.ow_job_internal_notes (
  job_id      uuid primary key references public.ow_jobs(id) on delete cascade,
  company_id  uuid not null references public.ow_companies(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  updated_by  uuid references public.ow_users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

comment on table public.ow_job_internal_notes is
  '求人の社内メモ（求人ごとに1件）。求職者には出さない。読み書きはその会社の現役の担当者だけ（RLS）。2026-10-12';

create index ow_job_internal_notes_company_idx on public.ow_job_internal_notes (company_id);

alter table public.ow_job_internal_notes enable row level security;

create policy ow_job_internal_notes_select on public.ow_job_internal_notes
  for select to authenticated
  using (public.auth_is_active_company_admin(company_id));

create policy ow_job_internal_notes_insert on public.ow_job_internal_notes
  for insert to authenticated
  with check (
    public.auth_is_active_company_admin(company_id)
    and exists (select 1 from public.ow_jobs j where j.id = job_id and j.company_id = ow_job_internal_notes.company_id)
  );

create policy ow_job_internal_notes_update on public.ow_job_internal_notes
  for update to authenticated
  using (public.auth_is_active_company_admin(company_id))
  with check (
    public.auth_is_active_company_admin(company_id)
    and exists (select 1 from public.ow_jobs j where j.id = job_id and j.company_id = ow_job_internal_notes.company_id)
  );

create policy ow_job_internal_notes_delete on public.ow_job_internal_notes
  for delete to authenticated
  using (public.auth_is_active_company_admin(company_id));

revoke all on public.ow_job_internal_notes from anon, public;
grant select, insert, update, delete on public.ow_job_internal_notes to authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.ow_job_internal_notes', 'SELECT') then
    raise exception 'anon が社内メモを読める。中止';
  end if;
  if not has_table_privilege('authenticated', 'public.ow_job_internal_notes', 'SELECT') then
    raise exception 'authenticated に SELECT が無い。中止';
  end if;
end $$;
