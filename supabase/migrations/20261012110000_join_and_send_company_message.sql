-- ★やり取りに参加していない管理者が、返信すると同時に参加する（2026-10-12 / 柴さんの指示）。
--   「参加者に追加」と「メッセージを送る」を1つのトランザクションで行う。途中で失敗したらどちらも残らない。
--
-- ⚠️★サーバー専用（service_role だけが呼べる）。呼ぶ前に API が確かめること:
--      ・呼んだ人が p_sender_ow_user_id 本人である（getTenantContext）
--      ・送ってよい理由がまだ有効で、検証用と実アカウントの間でない（companyConversationSendAllowed）
--   この関数の中でも、企業との会話であること・送る人がその会社の**現役の管理者**であることは確かめる（二重に守る）。
-- ⚠️ 既に参加者なら新しく足さない（その参加者として送る）。退出した行（left_at あり）は使わず、新しく足す。
-- ⚠️ p_fail_at_end は検証用（最後に例外を出して、参加者もメッセージも残らないことを確かめる）。
-- ⚠️ scripts/check-definer-grants.sh の SERVER_ONLY に足してある。

create or replace function public.join_and_send_company_message(
  p_conversation_id uuid,
  p_sender_ow_user_id uuid,
  p_body text,
  p_fail_at_end boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_kind text;
  v_participant uuid;
  v_message uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_body = '' or char_length(v_body) > 5000 then
    raise exception 'invalid body' using errcode = '22023';
  end if;

  select company_id, kind into v_company, v_kind
    from ow_conversations where id = p_conversation_id for update;
  if v_company is null or v_kind is distinct from 'company' then
    raise exception 'not a company conversation' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from ow_company_admins
     where user_id = p_sender_ow_user_id and company_id = v_company and is_active
  ) then
    raise exception 'not an active admin of this company' using errcode = '42501';
  end if;

  select id into v_participant from ow_conversation_participants
   where conversation_id = p_conversation_id and user_id = p_sender_ow_user_id and left_at is null
   limit 1;
  if v_participant is null then
    insert into ow_conversation_participants (conversation_id, user_id, role)
    values (p_conversation_id, p_sender_ow_user_id, 'company_admin')
    returning id into v_participant;
  end if;

  insert into ow_conversation_messages (conversation_id, sender_participant_id, body, sent_at)
  values (p_conversation_id, v_participant, v_body, now())
  returning id into v_message;

  if p_fail_at_end then
    raise exception 'fail_at_end (検証用)' using errcode = 'P0001';
  end if;

  return v_message;
end;
$$;

revoke execute on function public.join_and_send_company_message(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.join_and_send_company_message(uuid, uuid, text, boolean) to service_role;

comment on function public.join_and_send_company_message(uuid, uuid, text, boolean) is
  'やり取りに参加していない管理者が返信すると同時に参加する（参加者の追加とメッセージの送信を1トランザクションで）。サーバー専用。2026-10-12';
