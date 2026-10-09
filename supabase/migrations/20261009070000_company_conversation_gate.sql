-- ════════════════════════════════════════════════════════════════════════
-- 企業との会話は、サーバーが「開いてよい理由」を確かめたときだけ作れて、送れるようにする
-- （2026-10-09 / 段階2）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★何が起きていたか（2026-10-09 に検証用アカウントで実測）
--   応募・面談申込・提案の双方合意のどれも無いまま、求職者が
--     ① `create_conversation` を直接呼ぶ、または
--     ② `ow_conversations` に直接 INSERT する（RLS が「候補者が自分なら可」で通していた）
--   ことで企業との会話を作り、メッセージを送れた。その会話は企業の `/biz/conversations` に出た。
--
-- ★この migration でやること（★関数を分けるだけ。**古いコードのままでも動き、結果も変わらない**）
--   1. `can_send_scout()` を「転職意欲」と「それ以外」に分ける。
--        can_contact_without_stance … 転職意欲**以外**（is_test の一致／管理者本人／グループを含む在籍歴／
--                                     自由入力の照合／手動ブロック／転職勧奨禁止）。
--        can_send_scout             … 転職意欲 ＋ can_contact_without_stance。**結果は変わらない**（下で検算）。
--      ⚠️ 応募・面談申込（**本人が自分から連絡した**もの）は転職意欲を見ずに会話を開く
--         （柴さんの判断。見ると、実在の利用者39人中17人が応募できても会話が開かない）。
--         そのための関数。**条件を TS に書き写さない**ため、SQL を1か所に保つ。
--   2. ⚠️ 企業との会話を**クライアントから直接作れない・送れない**ようにする部分（ポリシーと
--      create_conversation の権限）は **20261009080000 に分けた。** 今のデプロイ済みのコードは
--      セッションのクライアントで会話を作り・送っているので、**コードのデプロイと同時に当てる**。
--   判定そのものはアプリの `lib/conversations/openReason.ts` の1か所。
--
-- ⚠️ 差し替え前の can_send_scout の定義は 20261009040000 にある（戻すときはそれを当てる）。
-- ⚠️ 作業前ダンプ: .dumps/20261009-*-ow_conversation*.sql
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. 差し替え前の判定結果を控える（検算用）──────────────────────────────────
create temp table _before_can_send on commit drop as
select c.id as company_id, u.auth_id, public.can_send_scout(c.id, u.auth_id) as ok
  from ow_companies c
  join ow_users u on u.auth_id is not null
 where c.id in (select company_id from ow_company_admins where is_active)
    or c.listing_status = 'listed';

-- ── 1. 転職意欲以外の部分を、新しい関数に分ける ─────────────────────────────────
create or replace function public.can_contact_without_stance(p_company_id uuid, p_candidate_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- ★can_send_scout() から「転職意欲」の条件だけを抜いたもの（2026-10-09）。
  --   ⚠️ 中身は 20261009040000 の can_send_scout と同じ。**条件はここにだけ書く。**
  --   ⚠️ p_candidate_id は auth 空間。
  with viewer as (
    select c.id,
           c.is_test,
           normalize_company_name(c.name)                as name_norm,
           normalize_company_name(c.name_en)             as en_norm,
           normalize_company_name(c.parent_company_name) as parent_norm
      from ow_companies c
     where c.id = p_company_id
  ),
  cand as (
    select u.id, u.is_test from ow_users u where u.auth_id = p_candidate_id
  ),
  grp as (
    select c.id, c.name, c.name_en, c.search_aliases, c.parent_company_name
      from ow_companies c, viewer v
     where c.id = v.id
        or (v.parent_norm is not null
            and normalize_company_name(c.parent_company_name) = v.parent_norm)
        or normalize_company_name(c.parent_company_name) in (v.name_norm, v.en_norm)
        or (v.parent_norm is not null
            and v.parent_norm in (normalize_company_name(c.name), normalize_company_name(c.name_en)))
  ),
  grp_names as (
    select normalize_company_name(t.n) as nn
      from grp,
           lateral (
             select grp.name
             union all select grp.name_en
             union all select grp.parent_company_name
             union all select regexp_split_to_table(coalesce(grp.search_aliases, ''), '\s+')
           ) t(n)
  )
  select
    exists (select 1 from viewer)
    and exists (select 1 from cand)
    and (select v.is_test from viewer v) = (select c.is_test from cand c)
    and not exists (
      select 1 from ow_experiences e, cand
       where e.user_id = cand.id
         and e.company_id in (select id from grp)
    )
    and not exists (
      select 1 from ow_experiences e, cand
       where e.user_id = cand.id
         and e.company_id is null
         and e.company_text is not null
         and normalize_company_name(e.company_text) in (
               select nn from grp_names where nn is not null
             )
    )
    and not exists (
      select 1 from ow_company_admins a, cand
       where a.user_id = cand.id
         and a.company_id = p_company_id
         and a.is_active
    )
    and not exists (
      select 1 from ow_scout_blocks
       where candidate_id = p_candidate_id
         and company_id = p_company_id
    )
    and not is_solicitation_blocked(p_candidate_id);
$function$;

revoke execute on function public.can_contact_without_stance(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.can_contact_without_stance(uuid, uuid) to service_role;
comment on function public.can_contact_without_stance(uuid, uuid) is
  E'can_send_scout() から「転職意欲」の条件だけを抜いた判定（is_test の一致／管理者本人／グループを含む在籍歴／自由入力の照合／手動ブロック／転職勧奨禁止）。\n本人が自分から連絡した理由（応募・面談申込）で企業との会話を開くときに使う。service_role だけが実行できる。';

-- ── 2. can_send_scout は「転職意欲 ＋ それ以外」にする（結果は変えない）─────────────
create or replace function public.can_send_scout(p_company_id uuid, p_candidate_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- ★名前に反して「この企業にこの候補者を見せてよいか」。候補者検索と提案が通る（2026-10-09 に分けた）。
  --   条件1（転職意欲）だけここに書き、残りは can_contact_without_stance() にある。
  --   ⚠️ 条件を2か所に書かないこと。
  select
    coalesce(
      (select career_stance is not null and career_stance <> 'no_contact'
         from ow_profiles where user_id = p_candidate_id),
      false
    )
    and public.can_contact_without_stance(p_company_id, p_candidate_id);
$function$;

-- ── 検算（想定と違えばロールバック）─────────────────────────────────────────
do $$
declare
  v_diff int;
  v_total int;
begin
  select count(*), count(*) filter (where b.ok is distinct from public.can_send_scout(b.company_id, b.auth_id))
    into v_total, v_diff
    from _before_can_send b;
  if v_diff <> 0 then
    raise exception '検算失敗: can_send_scout の結果が % 組で変わった（全 % 組）', v_diff, v_total;
  end if;
  if v_total = 0 then
    raise exception '検算失敗（陽性対照）: 比べた組が0。検算になっていない';
  end if;
  if has_function_privilege('authenticated', 'public.can_contact_without_stance(uuid, uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.can_contact_without_stance(uuid, uuid)', 'EXECUTE') then
    raise exception '検算失敗: can_contact_without_stance がクライアントから実行できる';
  end if;
  if not has_function_privilege('service_role', 'public.can_contact_without_stance(uuid, uuid)', 'EXECUTE') then
    raise exception '検算失敗（陽性対照）: service_role が実行できない';
  end if;
  raise notice '検算OK: can_send_scout の結果は % 組すべて変わらず／can_contact_without_stance は service_role だけ', v_total;
end $$;

commit;

-- ★戻すとき: can_send_scout を 20261009040000 の定義で CREATE OR REPLACE し、
--   can_contact_without_stance を DROP する（他から呼ばれていないこと: 20261009080000 と
--   lib/conversations/openReason.ts を先に戻すこと）。
