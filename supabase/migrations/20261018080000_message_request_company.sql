-- ★個人どうしの最初の1通に「どの会社の話か」を持たせる（2026-10-18 / 柴さんの判断）
--
-- 企業ページの現役社員・OB/OG の行から「メッセージ」を押したとき、「会社のこと」のテーマをその企業ページの会社にする
-- （OB・OG なら「〈社名〉にいた頃のこと」）。それまでは相手の**現職**の会社になっていた ——
-- セールスフォースのページで元社員に送ると「アクセンチュアのこと」が出ていた。
-- テーマの値（company_culture など）は会社を区別しないので、どの会社の話かをこの列に残し、受け手に「働き方（Salesforce）」と出す。
--
-- ⚠️ 値を入れるのはサーバーだけ（sendMessageRequest）。相手がその会社の職歴を「会社名を出す」で持ち、
--    その会社のページが公開されているときだけ。会社のテーマを選んだときだけ（キャリアの相談には付けない）。
-- ⚠️★ow_conversations → ow_companies の外部キーが2本になる（company_id と request_company_id）。
--    ヒントの無い埋め込み ow_companies(...) は「どちらか分からない」で失敗する。
--    src の3か所は ow_companies!company_id(...) に直してから当てる（同じ変更に入っている）。適用後に scripts/check-embeds.mjs を走らせる。
--
-- 事前の実測（2026-10-18 / 本番）:
--   ow_conversations の direct_message 8行。request_format のあるもの1行（検証用）
--   authenticated は ow_conversations にテーブルレベルの SELECT / UPDATE を持つ（新しい列もそのまま読める）
--   → 書き換えは guard_conversation_request_fields が止める（下で request_company_id を足す）
--   読めるのは会話の当事者だけ（RLS）。社名は相手の /u/[id] に出ているものと同じなので、新しく漏れるものは無い
--
-- 戻し方:
--   alter table public.ow_conversations drop constraint ow_conversations_request_company_check;
--   alter table public.ow_conversations drop column request_company_id;
--   guard_conversation_request_fields を request_company_id の行を除いた形で当て直す（20261018070000 の定義）

alter table public.ow_conversations
  add column request_company_id uuid references public.ow_companies(id) on delete set null;

alter table public.ow_conversations add constraint ow_conversations_request_company_check
  check (request_company_id is null or kind = 'direct_message');

comment on column public.ow_conversations.request_company_id is
  '個人どうしの最初の1通で「会社のこと」を聞いたとき、どの会社の話か（企業ページから送ったときだけ）。2026-10-18〜。それより前は NULL';

-- ★クライアントのロールから書き換えさせない（request_topic / request_format と同じ扱い）。⚠️ CREATE OR REPLACE（トリガーが依存しているので DROP しない）
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
       or new.request_company_id is distinct from old.request_company_id
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
  if position('request_company_id' in (select prosrc from pg_proc where proname = 'guard_conversation_request_fields')) = 0 then
    raise exception 'guard に request_company_id が入っていない';
  end if;
  if position('request_format' in (select prosrc from pg_proc where proname = 'guard_conversation_request_fields')) = 0 then
    raise exception 'guard から request_format が落ちた';
  end if;
  if (select count(*) from public.ow_conversations where request_company_id is not null) <> 0 then
    raise exception '既存の行に値が入っている';
  end if;
end $$;
