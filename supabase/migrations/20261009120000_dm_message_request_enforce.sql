-- ════════════════════════════════════════════════════════════════════════
-- DM の「メッセージのお願い」—— 既存データの整理・ポリシー・必須化（2026-10-09 / 段階3 の B）
-- ════════════════════════════════════════════════════════════════════════
--
-- ⚠️★**コードのデプロイと同時に当てること。** 古いコードは DM を request_status 無しで作るので、
--    ここで必須にすると古いコードの DM 開始が落ちる。
--
-- ★やること
--   1. 既存の DM 3件（2026-10-09 実測。3件ともメッセージ0件・ボタンを押しただけでできた空の会話）
--      ・745a7644… … 参加者0件（誰も開けない）→ 削除
--      ・44de4c39… … 検証用と実在の組み合わせ → 削除（段階3で止める組み合わせ）
--      ・9c127891… … 実在どうし → request_status = 'accepted'（requested_at は作成日時）
--      参加者・通知は ON DELETE CASCADE で一緒に消える（通知は0件・メッセージは0件・参加者は2件）。
--      ⚠️ 保全: .dumps/20261009-1540-ow_conversations-ow_conversation_participants-ow_conversation_messages-ow_notifications.sql
--   2. DM は request_status / requested_at を必須にする（CHECK）。
--   3. ポリシー:
--      ・ow_conversations_select … 受け手（partner_user_id）が読めるのは**承認済みの DM か DM 以外**だけ。
--        承認前のお願いは、受け手からは会話の行も読めない。
--      ・ow_conversations_insert … クライアントから会話を作れないようにする（運営だけ）。
--        DM はサーバー（/api/dm/start）だけが作る。⚠️ 残すと、お願いを経ずに「承認済み」の DM を作れる。
--      ・ow_conversation_messages_insert … DM は**承認済み**のときだけ（サーバーは admin で入れる）。
--   3b. ow_conversations_update を参加者表を参照しない形にする（42P17 の再帰を解消）。
--   4. 会話の行の request_status / requested_at / responded_at / 当事者 / kind を
--      クライアントから書き換えられないようにする（BEFORE UPDATE トリガー）。
--      ⚠️ 送り手は ow_conversations_update で自分の会話を UPDATE できるので、無いと自分で承認できる。
--
-- ★戻すときの定義は末尾のコメント。
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. 既存の DM ─────────────────────────────────────────────────────────────
do $$
declare v_dm int; v_msgs int;
begin
  select count(*) into v_dm from ow_conversations where kind = 'direct_message';
  select count(*) into v_msgs from ow_conversation_messages m
    join ow_conversations c on c.id = m.conversation_id where c.kind = 'direct_message';
  if v_dm <> 3 or v_msgs <> 0 then
    raise exception '中止: DM が % 件・メッセージが % 件（想定は 3 件・0 件）。内容を確かめてから当てること', v_dm, v_msgs;
  end if;
  if (select count(*) from ow_conversations where id in (
        '745a7644-73ce-4a88-a767-3196ba86b7c5','44de4c39-112c-4232-ae20-7b97fa761f1d','9c127891-1711-4b96-acf7-aa3ddca86cd8')
        and kind = 'direct_message') <> 3 then
    raise exception '中止: 想定した DM 3件が揃っていない';
  end if;
end $$;

delete from ow_conversations
 where id in ('745a7644-73ce-4a88-a767-3196ba86b7c5', '44de4c39-112c-4232-ae20-7b97fa761f1d')
   and kind = 'direct_message';

update ow_conversations
   set request_status = 'accepted', requested_at = created_at
 where id = '9c127891-1711-4b96-acf7-aa3ddca86cd8' and kind = 'direct_message';

-- ── 2. DM は段を必須にする ───────────────────────────────────────────────────
alter table public.ow_conversations drop constraint if exists ow_conversations_dm_request_required;
alter table public.ow_conversations add constraint ow_conversations_dm_request_required
  check (kind <> 'direct_message' or (request_status is not null and requested_at is not null));

-- ── 3. ポリシー ──────────────────────────────────────────────────────────────
drop policy if exists ow_conversations_select on public.ow_conversations;
create policy ow_conversations_select on public.ow_conversations for select using (
     (candidate_user_id in (select ow_users.id from ow_users where ow_users.auth_id = auth.uid()))
  or (
       partner_user_id in (select ow_users.id from ow_users where ow_users.auth_id = auth.uid())
       and (kind <> 'direct_message' or request_status = 'accepted')
     )
  or (company_id is not null and exists (
        select 1 from ow_company_admins ca join ow_users u on u.id = ca.user_id
         where ca.company_id = ow_conversations.company_id and u.auth_id = auth.uid() and ca.is_active = true))
  or (exists (select 1 from ow_user_roles where ow_user_roles.user_id = auth.uid() and ow_user_roles.role = 'admin'))
);

drop policy if exists ow_conversations_insert on public.ow_conversations;
create policy ow_conversations_insert on public.ow_conversations for insert with check (auth_is_admin());

drop policy if exists ow_conversation_messages_insert on public.ow_conversation_messages;
create policy ow_conversation_messages_insert on public.ow_conversation_messages for insert with check (
  (exists (
     select 1 from ow_conversation_participants
      where ow_conversation_participants.id = ow_conversation_messages.sender_participant_id
        and ow_conversation_participants.user_id in (select ow_users.id from ow_users where ow_users.auth_id = auth.uid())
        and ow_conversation_participants.conversation_id = ow_conversation_messages.conversation_id
        and ow_conversation_participants.left_at is null))
  and (exists (
     select 1 from ow_conversations c
      where c.id = ow_conversation_messages.conversation_id
        and c.kind = 'direct_message'
        and c.request_status = 'accepted'))
);

-- ── 3b. UPDATE のポリシーを、参加者表を参照しない形にする ─────────────────────────
--   ⚠️★旧定義は ow_conversation_participants を参照しており、その表の SELECT ポリシーが
--      ow_conversations を参照し返すので、**クライアントからの UPDATE は必ず 42P17（ポリシーの再帰）で
--      500 になっていた**（2026-10-09 実測）。/api/biz/conversations/[id]/messages の
--      last_message_at 更新もこれで毎回失敗していた（警告ログだけで続行。値はトリガーが書く）。
--   ⚠️ 参加者の代わりに、当事者・企業の管理者（auth_is_company_admin は SECURITY DEFINER なので
--      再帰しない）・運営で判定する。DM の受け手は承認済みのときだけ。
--   ⚠️ 段と当事者の書き換えは下のトリガーが止める（ここは「誰がその行を更新してよいか」だけ）。
drop policy if exists ow_conversations_update on public.ow_conversations;
create policy ow_conversations_update on public.ow_conversations for update
  using (
       candidate_user_id = auth_ow_user_id()
    or (partner_user_id = auth_ow_user_id() and (kind <> 'direct_message' or request_status = 'accepted'))
    or (company_id is not null and auth_is_company_admin(company_id))
    or auth_is_admin()
  )
  with check (
       candidate_user_id = auth_ow_user_id()
    or (partner_user_id = auth_ow_user_id() and (kind <> 'direct_message' or request_status = 'accepted'))
    or (company_id is not null and auth_is_company_admin(company_id))
    or auth_is_admin()
  );

-- ── 4. 会話の行の段と当事者をクライアントから書き換えさせない ─────────────────────
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
       or new.kind is distinct from old.kind
       or new.candidate_user_id is distinct from old.candidate_user_id
       or new.partner_user_id is distinct from old.partner_user_id then
      raise exception 'この項目は変更できません' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

revoke execute on function public.guard_conversation_request_fields() from public, anon, authenticated;

drop trigger if exists trg_guard_conversation_request_fields on public.ow_conversations;
create trigger trg_guard_conversation_request_fields
  before update on public.ow_conversations
  for each row execute function public.guard_conversation_request_fields();

comment on function public.guard_conversation_request_fields() is
  E'ow_conversations の BEFORE UPDATE トリガー（2026-10-09 / 段階3）。メッセージのお願いの段（request_status ほか）と当事者・kind を、クライアントのロールから書き換えさせない。\n⚠️ 送り手は ow_conversations_update で自分の会話を UPDATE できるので、これが無いと自分で承認できる。';

-- ── 検算 ──────────────────────────────────────────────────────────────────
do $$
declare v_dm int; v_bad int;
begin
  select count(*) into v_dm from ow_conversations where kind = 'direct_message';
  select count(*) into v_bad from ow_conversations where kind = 'direct_message' and request_status is distinct from 'accepted';
  if v_dm <> 1 or v_bad <> 0 then
    raise exception '検算失敗: DM % 件・承認済みでないもの % 件（想定は 1 件・0 件）', v_dm, v_bad;
  end if;
  if pg_get_expr((select polwithcheck from pg_policy where polrelid = 'public.ow_conversations'::regclass and polname = 'ow_conversations_insert'),
                 'public.ow_conversations'::regclass) !~ 'auth_is_admin' then
    raise exception '検算失敗: ow_conversations_insert が運営だけになっていない';
  end if;
  raise notice '検算OK: DM は 1 件（承認済み）・ポリシーとトリガーを差し替えた';
end $$;

commit;

-- ★戻すとき（適用前の定義そのまま。データの削除は .dumps から戻す）:
--   drop trigger trg_guard_conversation_request_fields on public.ow_conversations;
--   drop function public.guard_conversation_request_fields();
--   alter table public.ow_conversations drop constraint ow_conversations_dm_request_required;
--   drop policy ow_conversations_select on public.ow_conversations;
--   create policy ow_conversations_select on public.ow_conversations for select using (
--        (candidate_user_id in (select ow_users.id from ow_users where ow_users.auth_id = auth.uid()))
--     or (partner_user_id in (select ow_users.id from ow_users where ow_users.auth_id = auth.uid()))
--     or ((company_id is not null) and (exists (select 1 from (ow_company_admins ca join ow_users u on (u.id = ca.user_id))
--          where ((ca.company_id = ow_conversations.company_id) and (u.auth_id = auth.uid()) and (ca.is_active = true)))))
--     or (exists (select 1 from ow_user_roles where ((ow_user_roles.user_id = auth.uid()) and (ow_user_roles.role = 'admin'::text)))));
--   drop policy ow_conversations_update on public.ow_conversations;
--   create policy ow_conversations_update on public.ow_conversations for update using (
--        (candidate_user_id in (select ow_users.id from ow_users where (ow_users.auth_id = auth.uid())))
--     or (exists (select 1 from ow_conversation_participants p where ((p.conversation_id = ow_conversations.id)
--          and (p.user_id in (select ow_users.id from ow_users where (ow_users.auth_id = auth.uid()))) and (p.left_at is null))))
--     or (exists (select 1 from ow_user_roles where ((ow_user_roles.user_id = auth.uid()) and (ow_user_roles.role = 'admin'::text)))));
--   drop policy ow_conversations_insert on public.ow_conversations;
--   create policy ow_conversations_insert on public.ow_conversations for insert with check (
--     (((kind = 'direct_message'::text) and (candidate_user_id = auth_ow_user_id())) or auth_is_admin()));
--   drop policy ow_conversation_messages_insert on public.ow_conversation_messages;
--   create policy ow_conversation_messages_insert on public.ow_conversation_messages for insert with check (
--     ((exists (select 1 from ow_conversation_participants
--        where ((ow_conversation_participants.id = ow_conversation_messages.sender_participant_id)
--          and (ow_conversation_participants.user_id in (select ow_users.id from ow_users where (ow_users.auth_id = auth.uid())))
--          and (ow_conversation_participants.conversation_id = ow_conversation_messages.conversation_id)
--          and (ow_conversation_participants.left_at is null))))
--      and (exists (select 1 from ow_conversations c where ((c.id = ow_conversation_messages.conversation_id) and (c.kind = 'direct_message'::text))))));
