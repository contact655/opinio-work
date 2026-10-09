-- ════════════════════════════════════════════════════════════════════════
-- 企業との会話を、クライアントから直接作れない・送れないようにする（2026-10-09 / 段階2）
-- ════════════════════════════════════════════════════════════════════════
--
-- ⚠️★**コードのデプロイと同時に当てること。** 先に当てると、デプロイ済みの古いコード
--    （応募・面談の API がセッションのクライアントで create_conversation を呼ぶ／
--     /api/biz/conversations/[id]/messages がセッションのクライアントで書く）が止まる。
--    承認までは supabase/pending/ に置き、当てる日に supabase/migrations/ へ移す。
--
-- ★やること
--   ow_conversations INSERT           … `kind = 'direct_message'` のときだけ（DM は段階3で決める）
--   ow_conversation_messages INSERT   … DM の会話にだけ
--   create_conversation の EXECUTE    … public・anon・authenticated から外し、service_role だけ
--   ⇒ 企業との会話は、サーバー（admin クライアント）が `lib/conversations/openReason.ts` で
--     「開いてよい理由」（応募・面談申込・提案の双方合意）を確かめたときだけ作れて、送れる。
-- ⚠️ 作業前ダンプ: .dumps/20261009-*-ow_conversation*.sql
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 企業との会話を、クライアントから直接作れない・送れないようにする ─────────────
drop policy if exists ow_conversations_insert on public.ow_conversations;
create policy ow_conversations_insert on public.ow_conversations
  for insert
  with check (
    (kind = 'direct_message' and candidate_user_id = auth_ow_user_id())
    or auth_is_admin()
  );

drop policy if exists ow_conversation_messages_insert on public.ow_conversation_messages;
create policy ow_conversation_messages_insert on public.ow_conversation_messages
  for insert
  with check (
    exists (
      select 1 from ow_conversation_participants
       where ow_conversation_participants.id = ow_conversation_messages.sender_participant_id
         and ow_conversation_participants.user_id in (select ow_users.id from ow_users where ow_users.auth_id = auth.uid())
         and ow_conversation_participants.conversation_id = ow_conversation_messages.conversation_id
         and ow_conversation_participants.left_at is null
    )
    -- ★DM の会話にだけ。企業との会話はサーバー（admin）だけが書く（判定を通したあと）
    and exists (
      select 1 from ow_conversations c
       where c.id = ow_conversation_messages.conversation_id
         and c.kind = 'direct_message'
    )
  );

revoke execute on function public.create_conversation(text, uuid, uuid, uuid) from public, anon, authenticated;
grant  execute on function public.create_conversation(text, uuid, uuid, uuid) to service_role;
comment on function public.create_conversation(text, uuid, uuid, uuid) is
  E'企業との会話を作る RPC。service_role（サーバーの admin クライアント）だけが呼ぶ（2026-10-09 にクライアントから外した）。\n呼ぶ前に必ず lib/conversations/openReason.ts で「開いてよい理由」（応募・面談申込・提案の双方合意）を確かめること。\n中の本人確認（呼んだ本人が p_candidate_user_id であること。service_role は素通し）は、クライアントから呼べた頃の名残として残してある。';

-- ── 検算 ─────────────────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('authenticated', 'public.create_conversation(text, uuid, uuid, uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.create_conversation(text, uuid, uuid, uuid)', 'EXECUTE') then
    raise exception '検算失敗: create_conversation がクライアントから実行できる';
  end if;
  if not has_function_privilege('service_role', 'public.create_conversation(text, uuid, uuid, uuid)', 'EXECUTE') then
    raise exception '検算失敗（陽性対照）: service_role が実行できない';
  end if;
  if (select count(*) from pg_policy where polrelid = 'public.ow_conversations'::regclass and polname = 'ow_conversations_insert'
        and pg_get_expr(polwithcheck, polrelid) like '%direct_message%') <> 1
     or (select count(*) from pg_policy where polrelid = 'public.ow_conversation_messages'::regclass and polname = 'ow_conversation_messages_insert'
        and pg_get_expr(polwithcheck, polrelid) like '%direct_message%') <> 1 then
    raise exception '検算失敗: ポリシーが想定どおりに張り替わっていない';
  end if;
  raise notice '検算OK: 企業との会話はクライアントから作れず・送れず、create_conversation は service_role だけ';
end $$;

commit;

-- ════════════════════════════════════════════════════════════════════════
-- ★戻すときの定義（差し替え前。2026-10-09 に本番の pg_policy / pg_proc から取得）
--   ⚠️ 戻すと、企業との会話をクライアントから理由なしに作れて送れる状態に戻る。
--
-- drop policy if exists ow_conversations_insert on public.ow_conversations;
-- create policy ow_conversations_insert on public.ow_conversations for insert
--   with check ((candidate_user_id = auth_ow_user_id()) OR auth_is_admin());
--
-- drop policy if exists ow_conversation_messages_insert on public.ow_conversation_messages;
-- create policy ow_conversation_messages_insert on public.ow_conversation_messages for insert
--   with check (EXISTS ( SELECT 1 FROM ow_conversation_participants
--     WHERE ((ow_conversation_participants.id = ow_conversation_messages.sender_participant_id)
--       AND (ow_conversation_participants.user_id IN ( SELECT ow_users.id FROM ow_users WHERE (ow_users.auth_id = auth.uid())))
--       AND (ow_conversation_participants.conversation_id = ow_conversation_messages.conversation_id)
--       AND (ow_conversation_participants.left_at IS NULL))));
--
-- grant execute on function public.create_conversation(text, uuid, uuid, uuid) to authenticated;
--   （適用前の ACL: postgres=X/postgres service_role=X/postgres authenticated=X/postgres）

