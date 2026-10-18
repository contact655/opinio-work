-- ★個人どうしの最初の1通に「どんな形で話を聞きたいか」を持たせる（2026-10-18 / 柴さんの判断）
--
-- キャリアの先輩に話を聞くための依頼を、いまの「メッセージのお願い」（request_topic＋ひとこと）に乗せる。
-- 足すのは形の1項目だけ: message（メッセージで）／ online_15（オンラインで15分）／ online_30（オンラインで30分）。
-- ⚠️ 対面は選べない（知らない人と1対1になるため。最初はオンラインかテキストだけ）。
-- ⚠️ 値の一覧は src/lib/constants/messageTopics.ts の MESSAGE_FORMATS と同じ（UI・API・DB の3層）。値は削除も改名もしない。
--
-- 事前の実測（2026-10-18 / 本番）:
--   ow_conversations の direct_message 7行。request_topic があるもの1行（検証用）。実在の利用者は0行
--   authenticated は ow_conversations にテーブルレベルの SELECT / UPDATE を持つ（新しい列もそのまま読める＝request_topic と同じ）
--   → 書き換えは guard_conversation_request_fields が止める（下で request_format を足す）
--
-- 戻し方:
--   alter table public.ow_conversations drop constraint ow_conversations_request_format_check;
--   alter table public.ow_conversations drop column request_format;
--   guard_conversation_request_fields を request_format の行を除いた形で当て直す（20261009 系の定義）

alter table public.ow_conversations add column request_format text;

alter table public.ow_conversations add constraint ow_conversations_request_format_check
  check (request_format is null or (kind = 'direct_message' and request_format in ('message', 'online_15', 'online_30')));

comment on column public.ow_conversations.request_format is
  '個人どうしの最初の1通で選んだ、話を聞く形（message / online_15 / online_30）。2026-10-18〜。それより前の会話は NULL';

-- ★クライアントのロールから書き換えさせない（request_topic と同じ扱い）。⚠️ CREATE OR REPLACE（トリガーが依存しているので DROP しない）
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
       or new.request_format is distinct from old.request_format
       or new.kind is distinct from old.kind
       or new.candidate_user_id is distinct from old.candidate_user_id
       or new.partner_user_id is distinct from old.partner_user_id then
      raise exception 'この項目は変更できません' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

do $$
begin
  if position('request_format' in (select prosrc from pg_proc where proname = 'guard_conversation_request_fields')) = 0 then
    raise exception 'guard に request_format が入っていない';
  end if;
  if (select count(*) from public.ow_conversations where request_format is not null) <> 0 then
    raise exception '既存の行に値が入っている';
  end if;
end $$;
