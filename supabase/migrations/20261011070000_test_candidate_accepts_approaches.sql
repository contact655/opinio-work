-- ════════════════════════════════════════════════════════════════════════
-- 「メッセージリクエストを受け取る」をオンにした検証用の候補者を1人、常に置く（2026-10-11 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- 目的: 企業側の「送る画面」（/biz/approaches/new）を実物で確かめられるようにする。
--   それまで検証用アカウントは全員「受け取る」が未設定（null）で、送る画面を開ける相手が0人だった
--   （プレビュー /dev/preview/approach-compose でしか見られなかった）。
--
-- 対象: contact+25@opinio.co.jp（ow_users.id = b0968ba2-b855-4b6d-81c2-56dac0584668 / is_test）。
--   転職意欲 researching・職歴2件・それまでリクエストも会話も0件。
--
-- ⚠️★is_test の会社からしか見えない。送れるかは can_send_company_approach()（＝ can_send_scout() の
--    is_test の一致を含む）が決めるので、実在の会社の候補者検索には出ない（適用後に実測する）。
-- ⚠️ 検証用アカウントの設定を変えるだけ。行は消さない・ほかの列は触らない。
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
declare v_test boolean; v_auth uuid;
begin
  select is_test, auth_id into v_test, v_auth from public.ow_users
   where id = 'b0968ba2-b855-4b6d-81c2-56dac0584668' and email = 'contact+25@opinio.co.jp';
  if v_test is distinct from true or v_auth is null then
    raise exception '想定外: 対象が検証用アカウントでない（中止）';
  end if;
end $$;

update public.ow_profiles p
   set accept_company_approaches = true
  from public.ow_users u
 where u.id = 'b0968ba2-b855-4b6d-81c2-56dac0584668'
   and u.is_test = true
   and p.user_id = u.auth_id;

do $$
declare n int;
begin
  select count(*) into n from public.ow_profiles p join public.ow_users u on u.auth_id = p.user_id
   where u.id = 'b0968ba2-b855-4b6d-81c2-56dac0584668' and p.accept_company_approaches is true;
  if n <> 1 then raise exception '想定外: 更新できていない（% 行）', n; end if;
end $$;

commit;
