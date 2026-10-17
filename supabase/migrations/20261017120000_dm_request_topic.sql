-- 個人どうしの最初の1通に「聞きたいテーマ」を持たせる（2026-10-17 / docs/messaging-unification-20261017.md 段階1）
--
-- ★何を足すか
--   ow_conversations.request_topic … 最初の1通で選んだテーマ（DM だけ。任意＝既存の行は NULL のまま）
--   値は src/lib/constants/messageTopics.ts の MESSAGE_TOPICS と同じ（UI・API・DB の3層）。
--   ⚠️ 値を足すときは、この CHECK とコードの両方に足す。削除・改名はしない。
--
-- ★既存データには触らない（推測で埋めない）。行の更新は0件。
--
-- ★クライアントからの書き換えを止める
--   guard_conversation_request_fields（BEFORE UPDATE）に request_topic を足す。
--   ⚠️ CREATE OR REPLACE（トリガーが依存しているので DROP しない）。中身は 20261009 の定義に1行足しただけ。
--
-- ★権限: ow_conversations の SELECT は authenticated にテーブルレベル（列を足せばそのまま読める）。
--   読めるのは RLS の範囲（送り手・返信済みの受け手・運営）。テーマは機微な情報ではない。
--   書くのはサーバー（service_role）だけ（INSERT は運営に限るポリシー）。
--
-- ★戻すとき: alter table public.ow_conversations drop column request_topic;
--             と、guard_conversation_request_fields から request_topic の行を外す

alter table public.ow_conversations add column if not exists request_topic text;

alter table public.ow_conversations
  add constraint ow_conversations_request_topic_check check (
    request_topic is null
    or (kind = 'direct_message' and request_topic in (
      'company_culture', 'company_business', 'company_workstyle',
      'career_foreign', 'career_manager', 'career_role_change', 'career_independent', 'career_other',
      'hiring_position', 'hiring_casual',
      'join_interest'
    ))
  );

comment on column public.ow_conversations.request_topic is
  '個人どうしの最初の1通で選んだ「聞きたいテーマ」（2026-10-17）。値は src/lib/constants/messageTopics.ts。DM だけ・NULL 可（それ以前の行）。書くのはサーバーだけ';

create or replace function public.guard_conversation_request_fields()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- サーバー（service_role）と運営は通す。クライアントのロールからの変更だけ止める
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not public.auth_is_admin() then
    if new.request_status is distinct from old.request_status
       or new.requested_at is distinct from old.requested_at
       or new.responded_at is distinct from old.responded_at
       or new.request_topic is distinct from old.request_topic
       or new.kind is distinct from old.kind
       or new.candidate_user_id is distinct from old.candidate_user_id
       or new.partner_user_id is distinct from old.partner_user_id then
      raise exception 'この項目は変更できません' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

-- 検算
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='ow_conversations' and column_name='request_topic') then
    raise exception 'request_topic が無い';
  end if;
  if (select count(*) from public.ow_conversations where request_topic is not null) <> 0 then
    raise exception '既存の行に値が入っている（想定は0件）';
  end if;
  if regexp_replace(pg_get_functiondef('public.guard_conversation_request_fields'::regproc), '--[^' || chr(10) || ']*', '', 'g') !~ 'request_topic' then
    raise exception 'guard_conversation_request_fields に request_topic が入っていない';
  end if;
end $$;
