-- ════════════════════════════════════════════════════════════════════════
-- キャリア相談をメッセージの1種類として持つ（2026-11-05 / 柴さんの了承）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★きっかけ: 個人どうしのメッセージに「相談メニュー」を足す。相談の中身（聞きたい話・特に聞きたいこと・
--    希望する話し方・ひとこと）は本文に埋め込まず、構造化して保存する。送ったときの会社名もその時点の値で残す。
--
-- 変えるもの:
--   ① ow_conversation_messages.kind に 'consult' を足す。中身は payload（jsonb）。
--      ⚠️ 読み書きの規則は src/lib/constants/careerConsult.ts（parseConsultInput / ConsultPayload）。
--      ⚠️ body は一覧の冒頭1行・メールの件名に使う代わりの文（「キャリア相談：〈聞きたい話〉」）。画面は payload から描く
--   ② ow_notifications.type に 'career_consult' を足す（ベルに「キャリア相談が届きました」）。
--      会話と送った人が必須（message と同じ形）
--   ③ ow_settings に返事待ちの上限 message_request_open_limit = 5 を入れる（運営が値を変えれば効く。無ければコードの既定 5）
--
-- ⚠️ GRANT は足さない（列は足していない。書き込みはサーバーの admin クライアントだけ）
-- ⚠️ 既存の行は変えない（kind と type の CHECK を広げるだけ・設定の行を1つ足すだけ）
--
-- 戻し方:
--    begin;
--    delete from public.ow_conversation_messages where kind = 'consult';   -- ⚠️ 相談を消すことになる。必要ならダンプしてから
--    delete from public.ow_notifications where type = 'career_consult';
--    -- ①②の CHECK を、下の「前の定義」に張り直す
--    delete from public.ow_settings where key = 'message_request_open_limit';
--    commit;
-- 前の定義（2026-11-04 に本番で読んだもの）:
--    ow_conversation_messages_kind_check: kind in ('text','meeting_slots','scheduling_link','proposal_intro')
--    ow_notifications_type_check / ow_notifications_target_check: career_consult を除いた形（下の定義から該当部分を外す）
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ① メッセージの種類
alter table public.ow_conversation_messages drop constraint ow_conversation_messages_kind_check;
alter table public.ow_conversation_messages add constraint ow_conversation_messages_kind_check
  check (kind = any (array['text','meeting_slots','scheduling_link','proposal_intro','consult']));

alter table public.ow_conversation_messages add constraint ow_conversation_messages_consult_payload_check
  check (kind <> 'consult' or (payload is not null and jsonb_typeof(payload) = 'object' and ask_topic is null));

-- ② 通知の種類
alter table public.ow_notifications drop constraint ow_notifications_type_check;
alter table public.ow_notifications add constraint ow_notifications_type_check
  check (type = any (array['like','comment','reply','comment_like','message','proposal','introduction',
    'message_request','message_request_accepted','company_approach','meeting_canceled','follow',
    'interest_no_reply','interest_company_joined','career_consult']));

alter table public.ow_notifications drop constraint ow_notifications_target_check;
alter table public.ow_notifications add constraint ow_notifications_target_check check (
  ((type = any (array['like','comment'])) and post_id is not null and actor_user_id is not null)
  or ((type = any (array['reply','comment_like'])) and post_id is not null and comment_id is not null and actor_user_id is not null)
  or ((type = any (array['message','message_request','message_request_accepted','career_consult'])) and conversation_id is not null and actor_user_id is not null)
  or (type = 'proposal' and proposal_id is not null and actor_company_id is not null)
  or (type = 'introduction' and conversation_id is not null and proposal_id is not null and actor_company_id is not null)
  or (type = 'company_approach' and approach_id is not null and actor_company_id is not null)
  or (type = 'meeting_canceled' and conversation_id is not null and actor_company_id is not null)
  or (type = 'follow' and actor_user_id is not null)
  or ((type = any (array['interest_no_reply','interest_company_joined'])) and actor_company_id is not null)
);

-- ③ 返事待ちの上限
insert into public.ow_settings (key, value, description, updated_at)
values ('message_request_open_limit', '5',
  '個人どうしのメッセージで、返事待ちにできる新しい相手の数（1〜100）。14日たった返事待ちは数えない。読むのは src/lib/conversations/messageRequest.ts',
  now())
on conflict (key) do nothing;

-- 検算: 既存の行が新しい CHECK を満たしている（満たさなければ add constraint が失敗して全体が戻る）・設定が1行ある
do $$
declare n int;
begin
  select count(*) into n from public.ow_settings where key = 'message_request_open_limit';
  if n <> 1 then raise exception '設定の行がありません（% 行）', n; end if;
end $$;

commit;
