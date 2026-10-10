-- ════════════════════════════════════════════════════════════════════════
-- メッセージリクエストを「そのまま返信できる」形にする（2026-10-11 / 柴さんの指示。LinkedIn の InMail に寄せる）
-- ════════════════════════════════════════════════════════════════════════
--
-- ① reply_to_company_approach … 企業からのリクエストに求職者が返信する。**1つの処理（1トランザクション）**で
--      返信済みにする（accepted_at。★列名は変えず、意味を「返信した日時」にした）→ 会話を開く（create_conversation）
--      → 送った担当者を参加者に入れる → 1通目（理由＋本文。送った担当者の名前のまま）→ 2通目（求職者の返信）
--      → conversation_id を記録。どこで失敗しても全部戻る（会話だけ開いて返信が無い、を残さない）。
--      ⚠️ 送った担当者がもう有効でなくても、その担当者の名前のまま1通目を入れる（柴さんの判断。順番 1→2 を崩さない）。
--         会話はその会社の有効な担当者なら誰でも見て返信できる（/biz の会話の決まり）。
-- ② reply_to_message_request … 個人どうしのリクエストに受け手が返信する。返信済みにする → 両者を参加者に入れる
--      → 受け手の返信を入れる。同じく1トランザクション。
--      ⚠️ 返信する前は受け手を参加者に加えない決まりはそのまま（本文はサーバーが admin で読んで見せる）。
-- ③ ow_user_blocks … 個人どうしのブロック。④ ow_message_reports … 運営への報告。
--      どちらも RLS 有効・ポリシー0本・anon / authenticated に GRANT なし（サーバーの admin だけが読み書き）。
--
-- ⚠️★①②とも SECURITY DEFINER で、実行できるのは service_role だけ（CLAUDE.md「DB 関数の書き方」⑤）。
--    呼んだ人の本人確認は API が行う（引数で渡された ID を API がセッションから組み立てる）。
-- ⚠️★p_fail_at_end は**検証専用**。true なら最後の手順のあとでわざと失敗し、全部が戻ることを確かめるためのもの。
--    アプリからは渡さない。
-- ⚠️ 失敗の理由は SQLSTATE で返す: OR404（見つからない・期限切れ）／OR409（既に答えた）／OR403（いま開けない）／OR400（本文）。
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── ③ ブロック ────────────────────────────────────────────────────────────
create table if not exists public.ow_user_blocks (
  blocker_user_id uuid not null references public.ow_users(id) on delete cascade,
  blocked_user_id uuid not null references public.ow_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  constraint ow_user_blocks_not_self check (blocker_user_id <> blocked_user_id)
);
comment on table public.ow_user_blocks is
  '個人どうしのブロック（2026-10-11）。blocker が blocked からのメッセージリクエスト・DM を受け取らない。相手には伝えない。サーバーの admin だけが読み書きする。';
alter table public.ow_user_blocks enable row level security;
revoke all on public.ow_user_blocks from anon, authenticated;

-- ── ④ 運営への報告 ────────────────────────────────────────────────────────
create table if not exists public.ow_message_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.ow_conversations(id) on delete set null,
  reporter_user_id uuid not null references public.ow_users(id) on delete cascade,
  reported_user_id uuid references public.ow_users(id) on delete set null,
  -- ⚠️ 報告した時点の本文を控える（会話が消えても運営が中身を確かめられるように）
  message_snapshot text,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
comment on table public.ow_message_reports is
  '届いたメッセージリクエストを運営に報告した記録（2026-10-11）。/admin/message-reports で見る。サーバーの admin だけが読み書きする。';
alter table public.ow_message_reports enable row level security;
revoke all on public.ow_message_reports from anon, authenticated;
create index if not exists ow_message_reports_created_idx on public.ow_message_reports (created_at desc);

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
  -- ★30日を過ぎたものには返信できない（求職者の一覧からも外れている）
  if v_row.created_at < now() - interval '30 days' then
    raise exception 'expired' using errcode = 'OR404';
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

-- ── ② 個人どうしのリクエストに返信する ─────────────────────────────────────
create or replace function public.reply_to_message_request(
  p_conversation_id uuid,
  p_recipient_ow_user_id uuid,
  p_body text,
  p_fail_at_end boolean default false
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_conv public.ow_conversations%rowtype;
  v_part uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'reply body length' using errcode = 'OR400';
  end if;

  select * into v_conv from public.ow_conversations
   where id = p_conversation_id
   for update;
  if not found or v_conv.kind <> 'direct_message' or v_conv.partner_user_id <> p_recipient_ow_user_id then
    raise exception 'not found' using errcode = 'OR404';
  end if;
  if v_conv.request_status <> 'pending' then
    raise exception 'already answered' using errcode = 'OR409';
  end if;
  -- 見送った・ブロックしたものには返信できない（一覧からも消えている）
  if exists (select 1 from public.ow_message_request_declines where conversation_id = p_conversation_id) then
    raise exception 'not found' using errcode = 'OR404';
  end if;

  update public.ow_conversations
     set request_status = 'accepted', responded_at = now()
   where id = p_conversation_id;

  -- 両者を参加者に（DM の role は両方 'candidate'。lib/conversations/participants.ts と同じ）
  insert into public.ow_conversation_participants (conversation_id, user_id, role)
  select p_conversation_id, u, 'candidate'
    from unnest(array[v_conv.candidate_user_id, p_recipient_ow_user_id]) as u
   where not exists (select 1 from public.ow_conversation_participants p
                      where p.conversation_id = p_conversation_id and p.user_id = u and p.left_at is null);

  select id into v_part from public.ow_conversation_participants
   where conversation_id = p_conversation_id and user_id = p_recipient_ow_user_id and left_at is null
   order by joined_at limit 1;

  insert into public.ow_conversation_messages (conversation_id, sender_participant_id, body, sent_at)
  values (p_conversation_id, v_part, v_body, clock_timestamp());

  if p_fail_at_end then
    raise exception 'test: fail at end' using errcode = 'OR999';
  end if;

  return p_conversation_id;
end;
$$;
comment on function public.reply_to_message_request(uuid, uuid, text, boolean) is
  '個人どうしのメッセージリクエストに受け手が返信する（2026-10-11）。返信済み・参加者・返信を1トランザクションで作る。service_role だけ。p_fail_at_end は検証専用。';
revoke execute on function public.reply_to_message_request(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.reply_to_message_request(uuid, uuid, text, boolean) to service_role;

-- 検算
do $$
begin
  if has_function_privilege('authenticated', 'public.reply_to_company_approach(uuid,uuid,text,boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.reply_to_message_request(uuid,uuid,text,boolean)', 'EXECUTE') then
    raise exception 'クライアントのロールに実行権限が残っている';
  end if;
  if has_table_privilege('authenticated', 'public.ow_user_blocks', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_message_reports', 'SELECT') then
    raise exception 'クライアントのロールに表の権限が残っている';
  end if;
end $$;

commit;
