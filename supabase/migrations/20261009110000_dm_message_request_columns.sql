-- ════════════════════════════════════════════════════════════════════════
-- DM の「メッセージのお願い」—— 列・表・索引・通知の種類を足す（2026-10-09 / 段階3 の A）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★この migration は**足すだけ**（古いコードのままでも壊れない）。
--   既存データの更新・削除と、ポリシーの差し替え・必須化は 20261009120000（コードと同時に当てる）。
--
-- ★やること
--   1. ow_conversations に request_status / requested_at / responded_at を足す。
--      ・request_status は 'pending' / 'accepted' の2値。**DM 以外は null**（CHECK）。
--      ・⚠️★**「断った」をこの列に書かない。** 送り手（candidate_user_id）は自分の会話の行を
--         PostgREST から読める（ow_conversations_select）ので、'declined' を書くと断られたことが
--         送り手に分かってしまう。断っても送り手には「まだ承認されていません」のままにする決まり。
--   2. 断った記録は ow_message_request_declines（運営専用・RLS 有効・ポリシー0本・GRANT 無し。
--      ow_proposal_declines と同じ形）に置く。読むのはサーバーの admin クライアントだけ。
--   3. 同じ2人の DM が向きに関係なく1本だけになる一意の索引。
--      既存の重複は 0件（2026-10-09 実測）。
--   4. 通知の種類に 'message_request'（お願いが届いた）と 'message_request_accepted'（承認された）を足す。
--      ⚠️ `GET /api/jobseeker/notifications` の survives() にも case を足すこと（同じコミット）。
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. 列 ────────────────────────────────────────────────────────────────────
alter table public.ow_conversations
  add column if not exists request_status text,
  add column if not exists requested_at timestamptz,
  add column if not exists responded_at timestamptz;

alter table public.ow_conversations
  drop constraint if exists ow_conversations_request_status_check;
alter table public.ow_conversations
  add constraint ow_conversations_request_status_check
  check (
    (request_status is null or request_status in ('pending', 'accepted'))
    and (kind = 'direct_message' or (request_status is null and requested_at is null and responded_at is null))
  );

comment on column public.ow_conversations.request_status is
  E'DM の「メッセージのお願い」の段（2026-10-09）。pending = 承認待ち / accepted = 承認済み。DM 以外は null。\n⚠️ 断ったことはここに書かない（送り手が読めるため）。ow_message_request_declines に置く。';
comment on column public.ow_conversations.requested_at is 'DM のお願いを送った日時（2026-10-09）。1日の上限を数えるのに使う。';
comment on column public.ow_conversations.responded_at is 'DM のお願いを承認した日時（2026-10-09）。⚠️ 断ったときは書かない（送り手に分かるため）。';

-- ── 2. 断った記録（運営専用）──────────────────────────────────────────────────
create table if not exists public.ow_message_request_declines (
  conversation_id uuid primary key references public.ow_conversations(id) on delete cascade,
  declined_at timestamptz not null default now()
);
alter table public.ow_message_request_declines enable row level security;
revoke all on public.ow_message_request_declines from anon, authenticated;
grant all on public.ow_message_request_declines to service_role;

comment on table public.ow_message_request_declines is
  E'DM のお願いを受け手が断った記録（2026-10-09）。⚠️ 送り手に断ったことを伝えないため、ow_conversations とは別に置く。\nRLS 有効・ポリシー0本・anon/authenticated に GRANT 無し。読むのは admin クライアントだけ。';

-- ── 3. 同じ2人の DM は1本だけ ─────────────────────────────────────────────────
create unique index if not exists ow_conversations_dm_pair_unique
  on public.ow_conversations (least(candidate_user_id, partner_user_id), greatest(candidate_user_id, partner_user_id))
  where kind = 'direct_message';

-- ── 4. 通知の種類 ────────────────────────────────────────────────────────────
alter table public.ow_notifications drop constraint if exists ow_notifications_type_check;
alter table public.ow_notifications add constraint ow_notifications_type_check
  check (type = any (array['like','comment','message','proposal','introduction','message_request','message_request_accepted']));

alter table public.ow_notifications drop constraint if exists ow_notifications_target_check;
alter table public.ow_notifications add constraint ow_notifications_target_check
  check (
       (type = any (array['like','comment']) and post_id is not null and actor_user_id is not null)
    or (type = any (array['message','message_request','message_request_accepted']) and conversation_id is not null and actor_user_id is not null)
    or (type = 'proposal' and proposal_id is not null and actor_company_id is not null)
    or (type = 'introduction' and conversation_id is not null and proposal_id is not null and actor_company_id is not null)
  );

-- ── 検算 ──────────────────────────────────────────────────────────────────
do $$
begin
  if has_table_privilege('authenticated', 'public.ow_message_request_declines', 'SELECT')
     or has_table_privilege('anon', 'public.ow_message_request_declines', 'SELECT') then
    raise exception '検算失敗: ow_message_request_declines がクライアントから読める';
  end if;
  if not exists (select 1 from pg_indexes where indexname = 'ow_conversations_dm_pair_unique') then
    raise exception '検算失敗: 一意の索引が無い';
  end if;
  raise notice '検算OK: 列・表・索引・通知の種類を足した';
end $$;

commit;

-- ★戻すとき:
--   alter table public.ow_notifications drop constraint ow_notifications_target_check;
--   alter table public.ow_notifications add constraint ow_notifications_target_check check (
--        (type = any (array['like','comment']) and post_id is not null and actor_user_id is not null)
--     or (type = 'message' and conversation_id is not null and actor_user_id is not null)
--     or (type = 'proposal' and proposal_id is not null and actor_company_id is not null)
--     or (type = 'introduction' and conversation_id is not null and proposal_id is not null and actor_company_id is not null));
--   alter table public.ow_notifications drop constraint ow_notifications_type_check;
--   alter table public.ow_notifications add constraint ow_notifications_type_check
--     check (type = any (array['like','comment','message','proposal','introduction']));
--   drop index public.ow_conversations_dm_pair_unique;
--   drop table public.ow_message_request_declines;
--   alter table public.ow_conversations drop constraint ow_conversations_request_status_check;
--   alter table public.ow_conversations drop column request_status, drop column requested_at, drop column responded_at;
