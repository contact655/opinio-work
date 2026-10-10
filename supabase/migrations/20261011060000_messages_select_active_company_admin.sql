-- ════════════════════════════════════════════════════════════════════════
-- メッセージを読める企業側の参加者を「いま有効な担当者」に限る（2026-10-11）
-- ════════════════════════════════════════════════════════════════════════
--
-- 背景: 20261011050000 の reply_to_company_approach は、送った担当者がもう有効でなくても
--   その担当者の名前のまま1通目を入れるため（柴さんの判断）、**有効でない担当者を参加者に足す**。
--   ところが ow_conversation_messages_select は「参加者の行があれば読める」だけで、
--   担当者がいま有効かを見ていなかった。⇒ 辞めた担当者がログインできれば、
--   PostgREST から会話の本文を読めてしまう（セキュリティレビューの指摘）。
--   ⚠️ これは返信の機能が新しく作った穴ではなく、**既にあった穴**（担当者を外しても
--      参加者の行は残る）。返信の機能がそれを踏む経路を1本足したので、ここで塞ぐ。
--
-- 変更: 参加者の枝に「role が company_admin なら、その会話の企業の有効な担当者であること」を足す。
--   候補者・DM の参加者（role = 'candidate'）は今までどおり。運営（ow_user_roles.admin）も今までどおり。
--   ⚠️ 担当者が有効に戻れば、同じ行のまま読めるようになる（行を消さない・left_at を書かない）。
--   ⚠️ ow_conversations_select は既に「有効な担当者」で絞っているので触らない。
--
-- 事前の実測（2026-10-11 / 本番）: 企業側の参加者のうち、その企業の有効な担当者でない行は **0件**。
--   ＝ 今日読めている人が読めなくなることは無い。
-- ════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists ow_conversation_messages_select on public.ow_conversation_messages;

create policy ow_conversation_messages_select on public.ow_conversation_messages
  for select
  using (
    exists (
      select 1
        from public.ow_conversation_participants p
        join public.ow_conversations c on c.id = p.conversation_id
       where p.conversation_id = ow_conversation_messages.conversation_id
         and p.user_id in (select u.id from public.ow_users u where u.auth_id = auth.uid())
         and (
           p.role <> 'company_admin'
           or exists (
             select 1 from public.ow_company_admins ca
              where ca.user_id = p.user_id
                and ca.company_id = c.company_id
                and ca.is_active = true
           )
         )
    )
    or exists (
      select 1 from public.ow_user_roles r
       where r.user_id = auth.uid() and r.role = 'admin'
    )
  );

-- 検算: 企業側の参加者で、有効な担当者でない行が今日は0件であること（＝誰の見え方も変わらない）
do $$
declare n int;
begin
  select count(*) into n
    from public.ow_conversation_participants p
    join public.ow_conversations c on c.id = p.conversation_id
   where p.role = 'company_admin'
     and not exists (
       select 1 from public.ow_company_admins ca
        where ca.user_id = p.user_id and ca.company_id = c.company_id and ca.is_active = true
     );
  if n <> 0 then
    raise exception '想定外: 有効でない担当者の参加者行が % 件ある（見え方が変わる）', n;
  end if;
end $$;

commit;
