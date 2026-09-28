-- プラン行が無い企業3社に free を1本入れる（2026-09-29）
--
-- ── なぜ欠けていたか ──────────────────────────────────────────────────────
-- 「全社に active な `ow_company_plans` が1本ある」という前提で動いているが、
-- **その前提は崩れていた。**
--   `POST /api/jobseeker/companies`（求職者が経歴入力から会社を登録する入口）は
--   **意図して `ow_company_plans` を触らない**（あのルートは担当者にもしない。
--   ルート冒頭の注記を読むこと）。そこで作られた企業に**後から担当者が付く**と、
--   有効な管理者はいるのにプラン行が無い状態になる。
--
-- ⚠️ 実害が2つあった:
--   ① `getCompanyContext.planType` が null → `canUse()` が fail-closed で**全機能を閉じる**
--   ② `/admin/plans` の切り替えが「いまの active を閉じる」で0行 → エラーになり、
--      **運営が画面から直せなかった**（同日、0行を正常として扱うよう直した）
--
-- ⚠️★**「全企業に入れる」migration にしないこと。** 担当者が居ない企業（86社）に
--    プラン行を作っても意味が無いし、`/admin/plans` の一覧が使えなくなる。
--    **有効な管理者がいて、かつ行が無い3社だけ**を id で明示列挙する。
--
-- 対象（2026-09-29 実測。**3社とも `is_test`**）:
--   ce44864d-…  【テスト】株式会社サンプルワークス   source=null
--   b9a3b7e2-…  株式会社ZAP                          source='user'
--   69c3286a-…  株式会社テスト                        source='user'
--
-- ⚠️ `free` を入れる。`paid` にしないこと —— ベータ版期間中は請求しないと
--    規約 第4条2項 に定めた。**請求していない有料契約の記録を作らない。**
--    ベータ中の候補者検索は `lib/constants/plans.ts` の MATRIX（free でも true）で開く。
--
-- ── 直近に `ow_company_plans` を触った migration ────────────────────────
-- 2026-08-23 の3段→2段（starter/growth/scale → free/paid）。
-- **別の話で、打ち消していない。**

begin;

do $$
declare v_target int;
begin
  select count(*) into v_target from public.ow_companies c
   where c.id in (
     'ce44864d-5e66-4684-8723-29282e3d6f5c',
     'b9a3b7e2-15b0-4c70-8993-1d2f5d445934',
     '69c3286a-4425-4cc3-b3f4-ae5866cb74e5'
   )
     and not exists (select 1 from public.ow_company_plans p
                      where p.company_id = c.id and p.status = 'active');
  if v_target <> 3 then
    raise exception '中止: 対象が想定（3社）と違う（実際 %社）。既に入っているか id が違う', v_target;
  end if;
end $$;

insert into public.ow_company_plans (company_id, plan_type, billing_cycle, monthly_fee, started_at, ended_at, status)
select c.id, 'free', 'monthly', 0, now(), null, 'active'
  from public.ow_companies c
 where c.id in (
   'ce44864d-5e66-4684-8723-29282e3d6f5c',
   'b9a3b7e2-15b0-4c70-8993-1d2f5d445934',
   '69c3286a-4425-4cc3-b3f4-ae5866cb74e5'
 );

do $$
declare v_missing int; v_paid int;
begin
  -- ★有効な管理者がいる企業で、active なプランが無いものが0になったこと
  select count(*) into v_missing from public.ow_companies c
   where exists (select 1 from public.ow_company_admins a
                  where a.company_id = c.id and a.is_active)
     and not exists (select 1 from public.ow_company_plans p
                      where p.company_id = c.id and p.status = 'active');
  if v_missing <> 0 then
    raise exception '中止: プラン行が無い企業が %社 残っている', v_missing;
  end if;

  -- ⚠️ 有料を増やしていないこと（元から Third Box の1社だけ）
  select count(*) into v_paid from public.ow_company_plans
   where status = 'active' and plan_type = 'paid';
  if v_paid <> 1 then
    raise exception '中止: 有料プランの数が想定（1社）と違う（実際 %社）', v_paid;
  end if;

  raise notice 'OK: free を3本追加。プラン行が無い企業は0社／有料は1社のまま';
end $$;

commit;

-- ── 戻し方 ────────────────────────────────────────────────────────────────
-- delete from public.ow_company_plans
--  where status = 'active' and plan_type = 'free' and monthly_fee = 0
--    and company_id in ('ce44864d-…','b9a3b7e2-…','69c3286a-…');
