-- ════════════════════════════════════════════════════════════════════════
-- 「聞きたいこと」を会話ではなく1通ごとに持つ（2026-10-22 / 柴さんの了承）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★きっかけ: 最初の1通で選んだ「聞きたいこと」が会話（ow_conversations.request_topic）に1つだけ記録され、
--    会話の上に帯で出ていた。2通目以降に別のことを聞いても付けられず、ふつうのメッセージとの関係も分かりにくかった。
--    → メッセージの行に持たせ、吹き出しに札として出す。2通目以降も付けられる（付けなければふつうのメッセージ）。
--
-- 足す列（ow_conversation_messages）:
--    ask_topic      … 聞きたいこと（値は ow_conversations.request_topic と同じ語彙。lib/constants/messageTopics.ts の MESSAGE_TOPICS）
--    ask_format     … どんな形で（message / online_15 / online_30。MESSAGE_FORMATS）
--    ask_company_id … どの会社の話か（会社のテーマのときだけ）
--    ⚠️ ow_conversations.request_topic / request_format / request_company_id は残す（最初の1通の記録・一覧の見出し・メールの件名が読む）
--
-- 写すもの（バックフィル）: request_topic がある会話の「最初の1通」（送り手が始めた人・いちばん古い・text）。
--    会社は request_company_id。無ければ、送った時点の書く画面に出ていた会社（相手のいまの勤務先で、会社名を出している職歴）。
--    ⚠️ 2026-10-22 時点で request_topic がある会話は4本。
--
-- ⚠️ GRANT は足さない（この表はテーブル単位の権限。列は足した時点で同じ権限になる。書き込みはサーバーの admin クライアントだけ）
--
-- 戻し方:
--    alter table public.ow_conversation_messages
--      drop column ask_topic, drop column ask_format, drop column ask_company_id;
--    （会話の側の列は触っていないので、戻しても元の表示に戻る）
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.ow_conversation_messages
  add column ask_topic text,
  add column ask_format text,
  add column ask_company_id uuid references public.ow_companies(id) on delete set null;

alter table public.ow_conversation_messages
  add constraint ow_conversation_messages_ask_topic_check check (
    ask_topic is null or (kind = 'text' and ask_topic = any (array[
      'company_culture','company_business','company_workstyle',
      'career_foreign','career_manager','career_role_change','career_independent','career_other',
      'hiring_position','hiring_casual','join_interest']))),
  add constraint ow_conversation_messages_ask_format_check check (
    ask_format is null or (ask_topic is not null and ask_format = any (array['message','online_15','online_30']))),
  add constraint ow_conversation_messages_ask_company_check check (
    ask_company_id is null or ask_topic in ('company_culture','company_business','company_workstyle'));

comment on column public.ow_conversation_messages.ask_topic is
  '聞きたいこと（2026-10-22〜）。この1通に付けた札。null はふつうのメッセージ。語彙は MESSAGE_TOPICS（ow_conversations.request_topic と同じ）';
comment on column public.ow_conversation_messages.ask_format is
  'どんな形で（message / online_15 / online_30）。ask_topic があるときだけ';
comment on column public.ow_conversation_messages.ask_company_id is
  'どの会社の話か。会社のテーマ（company_*）のときだけ';

do $$
declare n int; expected int;
begin
  select count(*) into expected from public.ow_conversations where request_topic is not null;

  with firsts as (
    select distinct on (m.conversation_id) m.id, c.request_topic, c.request_format, c.request_company_id, c.partner_user_id
      from public.ow_conversation_messages m
      join public.ow_conversations c on c.id = m.conversation_id
      join public.ow_conversation_participants p on p.id = m.sender_participant_id
     where c.request_topic is not null and m.kind = 'text' and m.deleted_at is null
       and p.user_id = c.candidate_user_id
     order by m.conversation_id, m.sent_at, m.id
  )
  update public.ow_conversation_messages m
     set ask_topic = f.request_topic,
         ask_format = f.request_format,
         ask_company_id = case when f.request_topic like 'company\_%' then coalesce(f.request_company_id, (
             select e.company_id from public.ow_experiences e
              where e.user_id = f.partner_user_id and e.is_current and e.company_id is not null
                and e.visibility_company = 'real'
              order by e.started_at desc nulls last limit 1)) end
    from firsts f
   where m.id = f.id;
  get diagnostics n = row_count;
  if n <> expected then raise exception '想定外: 写した行が % 行（想定 %）', n, expected; end if;
end $$;

commit;
