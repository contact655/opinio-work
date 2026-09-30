-- `contact+46@opinio.co.jp`（鈴木 亮平）を is_test にする
--
-- CLAUDE.md「★★`contact+NN@opinio.co.jp` が `is_test` のまま残らず増える」の**6回目**。
-- 前回（`contact+45`）は 2026-09-30 01:00 に倒したばかりで、その後 12:11 に作られた。
--
-- ⚠️★**検査は効いていた。** `/admin` の要対応タスクが「is_test を立て忘れている行 1件」を
--    出している（`lib/admin/testLeftovers.ts` の条件で実測して確認済み）。
--    **「また起きた＝検査が壊れている」ではない。** 検査式を触らないこと。
--
-- ── なぜ急ぐか（実測 2026-09-30 / 本番）──────────────────────────────────────
-- この行は `visibility='login_only'` / `is_current=true` / `visibility_company='real'` で、
-- 掲載中の**株式会社セールスフォース・ジャパンの「現役社員」として実際に出ている。**
-- ⚠️ 同日 09:27〜11:45 に**実在の16人**が登録しており（gmail / icloud / outlook）、
--    その人たちの目に「検証用の人」が現役社員として見えている状態。
--
-- ⚠️★**行を消さない。`is_test` を立てるだけ**（`ow_users` を指す FK 45列のうち29列が CASCADE）。
-- ⚠️★**email はパターンで倒さず明示列挙する**（将来 `contact+4x` が実用途で使われうる）。
-- ⚠️ 企業側の取り残しは**0件**（この人が作った企業は無い。`ow_company_creations` で確認）。

begin;

do $$
declare
  v_id uuid;
  n_user_before int; n_exp_before int; n_sf_before int; n_parent_before int;
begin
  select id into v_id from public.ow_users where email = 'contact+46@opinio.co.jp';
  if v_id is null then raise exception 'contact+46@opinio.co.jp が見つからない'; end if;

  select count(*) into n_user_before from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;
  select count(distinct e.user_id) into n_exp_before
    from public.ow_experiences e join public.ow_users u on u.id = e.user_id
   where u.is_test is not true and u.is_system is not true and u.auth_id is not null;
  select count(*) into n_sf_before
    from public.ow_experiences e
    join public.ow_users u on u.id = e.user_id
    join public.ow_companies c on c.id = e.company_id
   where c.name = '株式会社セールスフォース・ジャパン' and e.is_current
     and u.is_test is not true and u.is_system is not true and u.auth_id is not null;
  select count(*) into n_parent_before
    from public.ow_experiences e
    join public.ow_users u on u.id = e.user_id
    join public.ow_roles r on r.id = e.role_category_id
   where r.parent_id is null
     and u.is_test is not true and u.is_system is not true and u.auth_id is not null;

  -- ⚠️ 想定と違えば中止する（別セッションが先に倒していた／別の取り残しが増えた等）
  if n_user_before <> 24 then raise exception '事前の実ユーザーが24人でない: %', n_user_before; end if;
  if n_sf_before   <> 1  then raise exception '事前のSF現役社員が1人でない: %',   n_sf_before;   end if;

  raise notice '事前: 実ユーザー % / 職歴あり % / SF現役 % / 大分類のまま %',
    n_user_before, n_exp_before, n_sf_before, n_parent_before;
end $$;

update public.ow_users
   set is_test = true
 where email = 'contact+46@opinio.co.jp';

do $$
declare n_user int; n_exp int; n_sf int; n_parent int; n_left int;
begin
  select count(*) into n_user from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;
  select count(distinct e.user_id) into n_exp
    from public.ow_experiences e join public.ow_users u on u.id = e.user_id
   where u.is_test is not true and u.is_system is not true and u.auth_id is not null;
  select count(*) into n_sf
    from public.ow_experiences e
    join public.ow_users u on u.id = e.user_id
    join public.ow_companies c on c.id = e.company_id
   where c.name = '株式会社セールスフォース・ジャパン' and e.is_current
     and u.is_test is not true and u.is_system is not true and u.auth_id is not null;
  select count(*) into n_parent
    from public.ow_experiences e
    join public.ow_users u on u.id = e.user_id
    join public.ow_roles r on r.id = e.role_category_id
   where r.parent_id is null
     and u.is_test is not true and u.is_system is not true and u.auth_id is not null;

  -- 取り残し検査（0 が正常）
  select count(*) into n_left from public.ow_users
   where email like 'contact+%@opinio.co.jp'
     and is_test is not true and is_system is not true and auth_id is not null;

  if n_user <> 23 then raise exception '事後の実ユーザーが23人でない: %', n_user; end if;
  if n_sf   <> 0  then raise exception '事後のSF現役社員が0人でない: %',   n_sf;   end if;
  if n_left <> 0  then raise exception '取り残しが残っている: % 件',       n_left; end if;

  -- ⚠️ 残る「大分類のまま」1件は 山下 真澄 の「公務・その他」で、**子が0件なので正しい状態。**
  --    直しにいかないこと（`20260930020000` の注記）。
  raise notice '事後: 実ユーザー % / 職歴あり % / SF現役 % / 大分類のまま % / 取り残し %',
    n_user, n_exp, n_sf, n_parent, n_left;
end $$;

commit;
