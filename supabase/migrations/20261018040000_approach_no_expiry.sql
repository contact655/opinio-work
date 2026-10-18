-- ★企業からのメッセージに期限を設けない（2026-10-18 / 柴さんの判断）
--
-- それまで reply_to_company_approach は「送ってから30日を過ぎたものには返信できない」（OR404）を持っていた。
-- 期限をなくしたので、その1か所だけを外す。他の中身は 20261011050000 と同じ（CREATE OR REPLACE。署名は変えない）。
--
-- 事前の実測（2026-10-18 / 本番）:
--   本番の関数は 20261011050000 と同じ（prosrc の md5 f157299ddff80d17aeb25b9ca0c9d190・'30 days' を含む）
--   ow_company_approaches 18行。返信なしで30日を過ぎたもの 3行（いずれも検証用の候補者 × 検証用の企業。うち2行は見送り済み）
--   → この変更で実在の利用者の受信一覧に戻ってくるものは0件
--
-- 戻し方: 20261011050000 の reply_to_company_approach をそのまま当て直す（30日の判定が戻る）。
-- ⚠️ CREATE OR REPLACE は GRANT を保つが、念のため末尾で付け直している（service_role だけ）。
-- ── ① 企業からのリクエストに返信する ───────────────────────────────────────
create or replace function public.reply_to_company_approach(
  p_approach_id uuid,
  p_candidate_ow_user_id uuid,
  p_body text,
  p_fail_at_end boolean default false
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.ow_company_approaches%rowtype;
  v_auth uuid;
  v_conv uuid;
  v_sender_part uuid;
  v_cand_part uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'reply body length' using errcode = 'OR400';
  end if;

  select * into v_row from public.ow_company_approaches
   where id = p_approach_id and candidate_user_id = p_candidate_ow_user_id
   for update;
  if not found then raise exception 'not found' using errcode = 'OR404'; end if;
  if v_row.accepted_at is not null or v_row.declined_at is not null then
    raise exception 'already answered' using errcode = 'OR409';
  end if;

  -- ★いまこの企業とやり取りを始めてよいか（ブロック・在籍の判明・転職意欲など）。判定は can_send_scout の1か所
  select auth_id into v_auth from public.ow_users where id = p_candidate_ow_user_id;
  if v_auth is null or not public.can_send_scout(v_row.company_id, v_auth) then
    raise exception 'not allowed' using errcode = 'OR403';
  end if;

  select c.conversation_id into v_conv
    from public.create_conversation('company', p_candidate_ow_user_id, v_row.company_id, null) c;

  select id into v_cand_part from public.ow_conversation_participants
   where conversation_id = v_conv and user_id = p_candidate_ow_user_id and left_at is null
   order by joined_at limit 1;

  -- 送った担当者（いまは有効でなくても、その名前のまま1通目を出す）
  if v_row.sender_user_id is not null then
    select id into v_sender_part from public.ow_conversation_participants
     where conversation_id = v_conv and user_id = v_row.sender_user_id
     order by joined_at limit 1;
    if v_sender_part is null then
      insert into public.ow_conversation_participants (conversation_id, user_id, role)
      values (v_conv, v_row.sender_user_id, 'company_admin')
      returning id into v_sender_part;
    end if;
  end if;

  -- 1通目（理由＋本文）→ 2通目（返信）。⚠️ 並びは sent_at で決まるので clock_timestamp() で前後をはっきりさせる
  insert into public.ow_conversation_messages (conversation_id, sender_participant_id, body, sent_at)
  values (v_conv, v_sender_part,
          '【送った理由】' || chr(10) || v_row.reason || coalesce(chr(10) || chr(10) || v_row.body, ''),
          clock_timestamp());
  insert into public.ow_conversation_messages (conversation_id, sender_participant_id, body, sent_at)
  values (v_conv, v_cand_part, v_body, clock_timestamp());

  update public.ow_company_approaches
     set accepted_at = now(), conversation_id = v_conv
   where id = p_approach_id;

  if p_fail_at_end then
    raise exception 'test: fail at end' using errcode = 'OR999';
  end if;

  return v_conv;
end;
$$;
comment on function public.reply_to_company_approach(uuid, uuid, text, boolean) is
  '企業からのメッセージリクエストに求職者が返信する（2026-10-11）。返信済み・会話・1通目（理由＋本文）・2通目（返信）を1トランザクションで作る。service_role だけ。p_fail_at_end は検証専用。';
revoke execute on function public.reply_to_company_approach(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.reply_to_company_approach(uuid, uuid, text, boolean) to service_role;

do $$
declare v_src text;
begin
  select prosrc into v_src from pg_proc where proname = 'reply_to_company_approach';
  if position('30 days' in v_src) > 0 then
    raise exception '30日の判定が残っている';
  end if;
  if has_function_privilege('anon', 'public.reply_to_company_approach(uuid, uuid, text, boolean)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.reply_to_company_approach(uuid, uuid, text, boolean)', 'EXECUTE') then
    raise exception 'anon / authenticated が実行できる';
  end if;
end $$;
