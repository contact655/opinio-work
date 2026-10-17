-- 企業からのメッセージを、プロフィールを「非公開」にした人には送れないようにする（2026-10-17）
--
-- ★なぜ
--   /mypage/settings の「非公開」は「自分だけが閲覧できます。企業の候補者検索にも表示されません。」と約束している
--   （lib/constants/profileVisibility.ts）。候補者一覧（lib/business/candidates/load.ts）と /u/[id] は
--   visibility='private' を落としているが、送信の判定 can_send_company_approach() は visibility を見ていなかった。
--   ⇒ 一覧から消えても、相手の ow_users.id を知っていれば POST /api/biz/approaches で送れる形だった
--     （非公開にする前に候補者一覧で見た人など）。
--   実測（2026-10-17 / 本番）: 非公開の利用者は 0人（システムユーザー1件だけ）。実害は出ていない。
--
-- ★どこに足すか
--   can_send_company_approach() だけ。⚠️ can_contact_without_stance() / can_send_scout() には足さない
--   ——そちらは「本人が応募・面談を申し込んだ」ときの会話の判定にも使われ、非公開の人が自分から
--   応募したときに会話が開かなくなる。止めたいのは「企業から始める」連絡だけ。
--
-- ★何を変えないか
--   引数・戻り値・GRANT（service_role だけ）。CREATE OR REPLACE なので ACL は保たれる。
--   中身は 20261011110000_approach_open_by_default.sql の定義に、visibility の1行を足しただけ。
--
-- ★戻すとき: 20261011110000_approach_open_by_default.sql の can_send_company_approach をそのまま当て直す

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
  select id, auth_id, is_test, is_system, visibility into cand from ow_users where id = p_candidate_ow_user_id;
  if not found or cand.auth_id is null or cand.is_system is true then return false; end if;
  -- ★プロフィールを「非公開」にした人には送らない（2026-10-17）
  if cand.visibility = 'private' then return false; end if;
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

-- 検算: 新しい定義に visibility の判定が入り、権限は service_role だけのまま
do $$
begin
  if regexp_replace(pg_get_functiondef('public.can_send_company_approach(uuid,uuid,uuid)'::regprocedure), '--[^' || chr(10) || ']*', '', 'g')
       !~ 'visibility = ''private''' then
    raise exception 'can_send_company_approach に visibility の判定が入っていない';
  end if;
  if has_function_privilege('anon', 'public.can_send_company_approach(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.can_send_company_approach(uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'can_send_company_approach がクライアントのロールから呼べる状態になっている';
  end if;
end $$;
