-- ════════════════════════════════════════════════════════════════════════
-- contact+52 / contact+53 を検証用（is_test = true）にする（2026-10-26 / フェーズ1a-7・柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★きっかけ: docs/phase0-decision-platform-20261026.md の冒頭。
--    contact+52@opinio.co.jp（2026-10-17 作成）と contact+53@opinio.co.jp（2026-10-20 作成）が
--    is_test = false のまま残り、実ユーザーとして数えられていた。どちらも株式会社Opinio の現職で、
--    同社の「現役」2名はこの2人だけだった（CLAUDE.md「contact+NN が is_test のまま残らず増える」と同じ形）。
--
-- 対象（id を明示列挙。パターンで倒さない）:
--    e26a6997-2e20-4a6e-a9f2-e141ed6297a9  contact+52@opinio.co.jp
--    21442271-f156-4a00-b6ba-8f6eaf3d0cbc  contact+53@opinio.co.jp
--
-- 作業前の実測（2026-10-26）:
--    実ユーザー（is_test でない・is_system でない・auth_id あり）44人
--    2人とも 職歴1件 ／ 担当者0 ／ 作成した会社0 ／ 投稿0 ／ 会話0
--    → 企業行の取り残しは無い（人を倒しても会社が残る形にならない）
-- 変わること: 実ユーザー 44 → 42 ／ 株式会社Opinio の現役（実ユーザー） 2 → 0
-- 作業前の控え: .dumps/20261026-1625-ow_users-ow_workplace_reviews.sql
--
-- 戻し方:
--    update ow_users set is_test = false
--     where id in ('e26a6997-2e20-4a6e-a9f2-e141ed6297a9','21442271-f156-4a00-b6ba-8f6eaf3d0cbc');
-- ⚠️ 行は消さない（ow_users を指す FK の多くが CASCADE）。
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
declare n_target int; n_real_before int; n_real_after int;
begin
  select count(*) into n_target from public.ow_users
   where id in ('e26a6997-2e20-4a6e-a9f2-e141ed6297a9','21442271-f156-4a00-b6ba-8f6eaf3d0cbc')
     and email in ('contact+52@opinio.co.jp','contact+53@opinio.co.jp')
     and is_test is not true;
  if n_target <> 2 then
    raise exception '対象が想定（2人・is_test でない）と違う: %', n_target;
  end if;

  select count(*) into n_real_before from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;

  update public.ow_users set is_test = true
   where id in ('e26a6997-2e20-4a6e-a9f2-e141ed6297a9','21442271-f156-4a00-b6ba-8f6eaf3d0cbc');

  select count(*) into n_real_after from public.ow_users
   where is_test is not true and is_system is not true and auth_id is not null;

  if n_real_after <> n_real_before - 2 then
    raise exception '実ユーザーの数が想定どおりに減っていない: % → %', n_real_before, n_real_after;
  end if;
  raise notice '実ユーザー % → %', n_real_before, n_real_after;
end $$;

commit;
