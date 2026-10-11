-- ════════════════════════════════════════════════════════════════════════
--
-- ⚠️★これを当てる commit で、src/lib/notify/companyMessageEmail.ts の `SEND_TO_REAL_USERS` を true にすること
--    （それまで企業からのメッセージのメールは検証用アカウントにしか送らない。2026-10-11 / 柴さんの指示）
-- 企業からのメッセージを「全員が最初から受け取る」形にする（2026-10-11 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★保留中（supabase/pending/）。柴さんが人数を確認し、利用者に伝えてから migrations/ へ移して当てる。
--
-- 何が変わるか:
--   can_send_company_approach() から「ow_profiles.accept_company_approaches is true」の条件だけを外す。
--   止める方法は「転職について」（career_stance = 'no_contact'）で兼ねる ——これは can_send_scout() の
--   条件1が既に見ているので、ここに書き足す必要は無い。
--
-- 変えないもの（関数の本文はこれ以外そのまま）:
--   転職意欲・在籍歴とグループ会社・ブロック・転職勧奨禁止（can_send_scout()）／受け取らない企業／
--   受け取る範囲（company_in_approach_range）／送り手と相手の is_test の一致。
--   月10通・返事待ち10件・理由30〜200字・30日・180日はアプリ側の判定で、この関数の外。
--
-- ⚠️ accept_company_approaches の列とデータは触らない（扱いは別に決める）。
-- ⚠️ CREATE OR REPLACE は ACL を保つ（service_role だけ）。下で検算する。
-- 実測（2026-10-11 / 実在の利用者41人）: 新たに届くようになるのは 22人
--   （積極的に検討中 4 ／ いい話があれば聞きたい 13 ／ 情報収集として 5。いまは全員が未選択＝受け取らない扱い）。
--   今は考えていない 14人・未設定 5人は変わらず届かない。
-- ════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.can_send_company_approach(p_company_id uuid, p_candidate_ow_user_id uuid, p_sender_ow_user_id uuid default null::uuid)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  cand record;
  v_sender_test boolean;
begin
  select id, auth_id, is_test, is_system into cand from ow_users where id = p_candidate_ow_user_id;
  if not found or cand.auth_id is null or cand.is_system is true then return false; end if;
  if p_sender_ow_user_id is not null then
    if p_sender_ow_user_id = p_candidate_ow_user_id then return false; end if;
    select is_test into v_sender_test from ow_users where id = p_sender_ow_user_id;
    if not found or (coalesce(v_sender_test, false) <> coalesce(cand.is_test, false)) then return false; end if;
  end if;
  -- 見せてよいか（転職意欲・在籍歴とグループ会社・ブロック・転職勧奨禁止・管理者本人・検証用の一致）
  --   ★転職意欲が「今は考えていない」なら、ここで届かない（2026-10-11 からこれが止める方法）
  if not coalesce(public.can_send_scout(p_company_id, cand.auth_id), false) then return false; end if;
  -- 受け取らない企業
  if exists (select 1 from ow_approach_blocked_companies where user_id = p_candidate_ow_user_id and company_id = p_company_id) then
    return false;
  end if;
  -- 範囲
  return public.company_in_approach_range(p_company_id, p_candidate_ow_user_id);
end;
$function$;

comment on function public.can_send_company_approach(uuid, uuid, uuid) is
  E'企業からのメッセージを送れるか（2026-10-11 に受け取る設定を判定から外した）。**判定はここだけ**（送信の API・候補者検索のボタン・/u/[id] のボタン）。\n= can_send_scout()（転職意欲を含む）＋ 受け取らない企業 ＋ 範囲（company_in_approach_range）＋ sender と相手の is_test の一致。\n⚠️ accept_company_approaches は見ない。止める方法は「転職について」の「今は考えていない」。service_role だけが呼べる。';

do $$
declare acl text;
begin
  select proacl::text into acl from pg_proc where oid = 'public.can_send_company_approach(uuid,uuid,uuid)'::regprocedure;
  if acl is distinct from '{postgres=X/postgres,service_role=X/postgres}' then
    raise exception '検算失敗: 実行権限が変わった (%)', acl;
  end if;
  if regexp_replace(pg_get_functiondef('public.can_send_company_approach(uuid,uuid,uuid)'::regprocedure), '--[^' || chr(10) || ']*', '', 'g') ~ 'accept_company_approaches' then
    raise exception '検算失敗: accept_company_approaches がまだ残っている';
  end if;
  raise notice '検算OK';
end $$;

commit;

-- ★戻すとき: 20261010030000_approach_range.sql の can_send_company_approach をそのまま当て直す
