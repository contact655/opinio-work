-- ════════════════════════════════════════════════════════════════════════
-- Next Manager: 募集と Hiring Manager を複数どうしで紐づける（2026-11-13 / 柴さんの指示）
--   「採用マネージャー（ユーザー）に募集を紐づける（複数）」「募集にも担当の Hiring Manager を紐づける」
-- ════════════════════════════════════════════════════════════════════════
--
-- 決めたこと:
--   ・紐付けは1つの表（ow_job_hiring_managers）に持ち、入口は2つ
--       ① 本人の設定画面（/mypage/settings の「採用中のマネージャー」）で自分の募集を選ぶ
--       ② 求人の編集画面（/biz/jobs/[id]/edit）で、その募集の Hiring Manager を選ぶ（jobs.edit の権限）
--     どちらも lib/nextManager/server.ts を通る（会社が同じか・有効な担当者かをそこで確かめる）。
--   ・求人ページ・ユーザー一覧に名前を出すのは、本人が「採用中」にしている人だけ（本人の同意。
--     ②で会社が紐づけただけでは公開しない）。
--   ・2026-11-13 の 20261113090000 で作った ow_company_admins.hiring_job_id（1件だけ）はこの表に置き換え、落とす。
--     本番の値は 0件（適用前に確かめる。違えば中止）。
--
-- ⚠️ 表は anon / authenticated に権限なし・ポリシー0本（ow_manager_matches と同じ形）。読み書きは API だけ。
-- ⚠️ user_id は ow_users 空間。担当者が会社を外れても行は消さない（表示のときに is_active で落とす）。
--
-- 戻し方:
--   alter table public.ow_company_admins add column hiring_job_id uuid references public.ow_jobs(id) on delete set null;
--   （guard_company_admin_hiring を 20261113090000 の本文に戻す）
--   drop table public.ow_job_hiring_managers;
-- ════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if exists (select 1 from public.ow_company_admins where hiring_job_id is not null) then
    raise exception 'hiring_job_id に値がある（0件のはず）。中止';
  end if;
end $$;

create table public.ow_job_hiring_managers (
  job_id      uuid not null references public.ow_jobs(id) on delete cascade,
  user_id     uuid not null references public.ow_users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.ow_users(id) on delete set null,
  primary key (job_id, user_id)
);
create index ow_job_hiring_managers_user_idx on public.ow_job_hiring_managers(user_id);
comment on table public.ow_job_hiring_managers is
  'Next Manager: 募集の Hiring Manager（2026-11-13）。複数どうし。公開するのは本人が採用中にしている有効な担当者だけ。読み書きは API（service role）だけ。anon / authenticated に GRANT しない・ポリシーを書かない。';

alter table public.ow_job_hiring_managers enable row level security;
revoke all on table public.ow_job_hiring_managers from public, anon, authenticated;
grant select, insert, update, delete on table public.ow_job_hiring_managers to service_role;

-- ── hiring_job_id を落とす。先にトリガーの本文から外す ─────────────────────
create or replace function public.guard_company_admin_hiring()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.is_hiring or new.hiring_note is not null or new.hiring_updated_at is not null then
        raise exception '採用中の設定は本人が設定画面から変えてください' using errcode = '42501';
      end if;
    elsif new.is_hiring is distinct from old.is_hiring
       or new.hiring_note is distinct from old.hiring_note
       or new.hiring_updated_at is distinct from old.hiring_updated_at then
      raise exception '採用中の設定は本人が設定画面から変えてください' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;
revoke execute on function public.guard_company_admin_hiring() from public, anon, authenticated;

alter table public.ow_company_admins drop column hiring_job_id;

-- ── 適用の中で確かめる ───────────────────────────────────────────────
do $$
begin
  if has_table_privilege('anon', 'public.ow_job_hiring_managers', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_job_hiring_managers', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_job_hiring_managers', 'INSERT')
     or has_table_privilege('authenticated', 'public.ow_job_hiring_managers', 'DELETE') then
    raise exception 'ow_job_hiring_managers にクライアントのロールの権限が残っている';
  end if;
  if (select count(*) from pg_policy where polrelid = 'public.ow_job_hiring_managers'::regclass) <> 0 then
    raise exception 'ow_job_hiring_managers にポリシーがある（0本のはず）';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.ow_company_admins'::regclass
                  and tgname = 'trg_guard_company_admin_hiring' and not tgisinternal) then
    raise exception 'trg_guard_company_admin_hiring が無い';
  end if;
  if regexp_replace(regexp_replace((select prosrc from pg_proc where proname = 'guard_company_admin_hiring'), '--[^\n]*', '', 'g'), '/\*.*?\*/', '', 'g') ~ 'hiring_job_id' then
    raise exception 'guard_company_admin_hiring の本文に hiring_job_id が残っている';
  end if;
end $$;

commit;
