-- ════════════════════════════════════════════════════════════════════════
-- 会話の日程調整（2026-10-10 / 声かけまわり 段4）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★やること
--   1. ow_conversation_messages に kind（text / meeting_slots / scheduling_link）と payload（jsonb）。
--      ⚠️ kind と payload を書けるのはサーバー（service_role）だけ。クライアントのロールから
--         text 以外を入れたり、payload を書き換えたりするのはトリガーで止める
--         （DM はクライアントから INSERT できるため。候補日の確定状態を本人が書き換えられないように）。
--   2. ow_company_admins.scheduling_url（担当者ごとの日程調整リンク。https のみ・2048字まで）。
--      ⚠️ サーバーからは URL を取りにいかない（画面に出すだけ）。
--   3. ow_meetings（面談の記録）。RLS: 当事者の企業の担当者と本人だけが読める。書くのはサーバーだけ。
--   4. 通知の種類に 'meeting_canceled'（企業が面談・候補日を取り消した → 求職者へ）。
--      ⚠️★GET /api/jobseeker/notifications の survives() とベルにも case を足す（同じコミット）。
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. メッセージの種類 ──────────────────────────────────────────────────
alter table public.ow_conversation_messages
  add column if not exists kind text not null default 'text',
  add column if not exists payload jsonb;
alter table public.ow_conversation_messages drop constraint if exists ow_conversation_messages_kind_check;
alter table public.ow_conversation_messages add constraint ow_conversation_messages_kind_check
  check (kind in ('text', 'meeting_slots', 'scheduling_link'));
comment on column public.ow_conversation_messages.kind is
  'メッセージの種類（2026-10-10）。text / meeting_slots（候補日）/ scheduling_link（日程調整リンク）。text 以外はサーバーだけが書ける';
comment on column public.ow_conversation_messages.payload is
  '種類つきのメッセージの中身（候補日・形式・時間・同席者・確定状態／リンク）。サーバーだけが書ける';

create or replace function public.guard_message_kind_payload()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.kind <> 'text' or new.payload is not null then
      raise exception '種類つきのメッセージはサーバーからだけ作れます' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.kind is distinct from old.kind or new.payload is distinct from old.payload then
      raise exception 'メッセージの種類と中身は変えられません' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_message_kind_payload on public.ow_conversation_messages;
create trigger trg_guard_message_kind_payload
  before insert or update on public.ow_conversation_messages
  for each row execute function public.guard_message_kind_payload();

-- ── 2. 担当者ごとの日程調整リンク ─────────────────────────────────────────
alter table public.ow_company_admins add column if not exists scheduling_url text;
alter table public.ow_company_admins drop constraint if exists ow_company_admins_scheduling_url_check;
alter table public.ow_company_admins add constraint ow_company_admins_scheduling_url_check
  check (scheduling_url is null or (scheduling_url ~ '^https://[^[:space:]]+$' and length(scheduling_url) <= 2048));
comment on column public.ow_company_admins.scheduling_url is
  '担当者の日程調整リンク（2026-10-10）。https のみ・2048字まで。サーバーからは取りにいかない（画面に出すだけ）';

-- ── 3. 面談の記録 ─────────────────────────────────────────────────────────
create table if not exists public.ow_meetings (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ow_conversations(id) on delete cascade,
  company_id uuid not null references public.ow_companies(id) on delete cascade,
  candidate_user_id uuid not null references public.ow_users(id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes in (30, 60)),
  format text not null check (format in ('online', 'onsite')),
  attendees text[] not null default '{}',
  status text not null default 'scheduled' check (status in ('scheduled', 'canceled')),
  source text not null check (source in ('slots', 'link')),
  slots_message_id uuid references public.ow_conversation_messages(id) on delete set null,
  created_by uuid references public.ow_users(id) on delete set null,
  created_at timestamptz not null default now(),
  canceled_at timestamptz,
  canceled_by uuid references public.ow_users(id) on delete set null,
  constraint ow_meetings_canceled_consistency check ((status = 'canceled') = (canceled_at is not null))
);
comment on table public.ow_meetings is
  E'面談の記録（2026-10-10 / 段4）。候補日から確定したもの（source=slots）と、日程調整リンクで決まった日時を企業が記録したもの（source=link）。\n読めるのは当事者の企業の担当者と本人だけ。書くのはサーバーだけ（/api/meetings/*）。';

-- 同じ候補日のメッセージから、確定した面談は1件だけ
create unique index if not exists ow_meetings_one_per_slots_message
  on public.ow_meetings (slots_message_id) where status = 'scheduled' and slots_message_id is not null;
create index if not exists ow_meetings_company_starts on public.ow_meetings (company_id, starts_at);
create index if not exists ow_meetings_candidate on public.ow_meetings (candidate_user_id);

alter table public.ow_meetings enable row level security;
drop policy if exists ow_meetings_party_select on public.ow_meetings;
create policy ow_meetings_party_select on public.ow_meetings
  for select to authenticated
  using (public.auth_is_company_admin(company_id) or candidate_user_id = public.auth_ow_user_id());
revoke all on public.ow_meetings from anon, authenticated;
grant select on public.ow_meetings to authenticated;

-- ── 4. 通知の種類 ─────────────────────────────────────────────────────────
alter table public.ow_notifications
  add column if not exists meeting_id uuid references public.ow_meetings(id) on delete cascade;
alter table public.ow_notifications drop constraint if exists ow_notifications_type_check;
alter table public.ow_notifications add constraint ow_notifications_type_check
  check (type = any (array['like','comment','message','proposal','introduction','message_request','message_request_accepted','company_approach','meeting_canceled']));
alter table public.ow_notifications drop constraint if exists ow_notifications_target_check;
alter table public.ow_notifications add constraint ow_notifications_target_check
  check (
       (type = any (array['like','comment']) and post_id is not null and actor_user_id is not null)
    or (type = any (array['message','message_request','message_request_accepted']) and conversation_id is not null and actor_user_id is not null)
    or (type = 'proposal' and proposal_id is not null and actor_company_id is not null)
    or (type = 'introduction' and conversation_id is not null and proposal_id is not null and actor_company_id is not null)
    or (type = 'company_approach' and approach_id is not null and actor_company_id is not null)
    or (type = 'meeting_canceled' and conversation_id is not null and actor_company_id is not null)
  );

-- ── 検算 ──────────────────────────────────────────────────────────────────
do $$
begin
  if has_table_privilege('anon', 'public.ow_meetings', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_meetings', 'INSERT')
     or has_table_privilege('authenticated', 'public.ow_meetings', 'UPDATE') then
    raise exception '検算失敗: ow_meetings の権限が想定と違う';
  end if;
  if exists (select 1 from public.ow_conversation_messages where kind <> 'text') then
    raise exception '検算失敗: 既存のメッセージに text 以外がある';
  end if;
  raise notice '検算OK: メッセージの種類・日程調整リンク・ow_meetings・取り消しの通知を足した';
end $$;

commit;

-- ★戻すとき:
--   delete from public.ow_notifications where type = 'meeting_canceled';
--   （type/target の CHECK を 20261009190000 の形に戻す）alter table public.ow_notifications drop column meeting_id;
--   drop table public.ow_meetings;
--   alter table public.ow_company_admins drop column scheduling_url;
--   drop trigger trg_guard_message_kind_payload on public.ow_conversation_messages; drop function public.guard_message_kind_payload();
--   alter table public.ow_conversation_messages drop column payload, drop column kind;
