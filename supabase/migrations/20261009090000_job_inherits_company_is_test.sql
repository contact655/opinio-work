-- ════════════════════════════════════════════════════════════════════════
-- 検証用企業（is_test）の求人は、必ず検証用の求人にする（2026-10-09）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★何が起きうるか
--   公開側の求人クエリ（/jobs・トップ・サジェスト・sitemap・企業ページ・求人詳細・フィード）は
--   **求人自身の is_test しか見ていない。** 企業の is_test は見ていない。
--   `/biz` から作る求人は is_test を付けない（既定 false）ので、検証用企業が作った求人を
--   運営が公開すると、そのまま公開側に出る。
--   実測（2026-10-09 / 本番）: 該当 0件（検証用企業の求人2件はどちらも is_test=true）。
--   ＝ **起きていなかったが、起こせる形だった。**
--
-- ★この migration でやること
--   1. ow_jobs の INSERT / UPDATE で、企業が is_test なら求人も is_test にする（BEFORE トリガー）。
--      /biz からの作成・運営からの作成・今後足す経路の**すべて**に効く（アプリの経路ごとに書かない）。
--   2. 企業が is_test になったら、その企業の求人も is_test にする（AFTER トリガー）。
--      ⚠️ 逆向き（企業の is_test を外す）では求人を戻さない。検証用に作った求人は検証用のまま。
--   3. 既存の食い違いを揃える（実測 0件。0件でなければ件数を報告してから当てる約束なので、
--      想定と違えば中止する）。
--
-- ⚠️ 結果として「求人の is_test = false」は「企業も is_test でない」を含む。公開側のクエリは
--    `lib/jobs/publicJobs.ts` の PUBLIC_JOB_MATCH を通し、この不変条件に乗る。
-- ⚠️ SECURITY DEFINER（呼んだ人が企業を読めなくても判定できるように）。トリガー関数なので
--    RPC からは呼べないが、決まりどおり EXECUTE はクライアントのロールから外す
--    （CLAUDE.md「DB 関数の書き方」⑤）。
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. 想定の確認（食い違いが 0件であること）──────────────────────────────────
do $$
declare v int;
begin
  select count(*) into v
    from ow_jobs j join ow_companies c on c.id = j.company_id
   where c.is_test and not j.is_test;
  if v <> 0 then
    raise exception '中止: 企業が is_test なのに求人が is_test でない行が % 件ある（0件の想定）', v;
  end if;
end $$;

-- ── 1. 求人を作る・変えるとき ────────────────────────────────────────────────
create or replace function public.inherit_company_is_test_to_job()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- 企業が検証用なら、求人も検証用にする（外す方向には触らない）
  if exists (select 1 from ow_companies c where c.id = new.company_id and c.is_test) then
    new.is_test := true;
  end if;
  return new;
end;
$function$;

revoke execute on function public.inherit_company_is_test_to_job() from public, anon, authenticated;

drop trigger if exists trg_ow_jobs_inherit_company_is_test on public.ow_jobs;
create trigger trg_ow_jobs_inherit_company_is_test
  before insert or update of company_id, is_test on public.ow_jobs
  for each row execute function public.inherit_company_is_test_to_job();

comment on function public.inherit_company_is_test_to_job() is
  E'ow_jobs の BEFORE INSERT/UPDATE トリガー。企業が is_test なら求人も is_test にする（2026-10-09）。\n公開側の求人クエリは求人の is_test だけを見るので、この不変条件で検証用企業の求人を出さない。';

-- ── 2. 企業が検証用になったとき ──────────────────────────────────────────────
create or replace function public.propagate_company_is_test_to_jobs()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update ow_jobs set is_test = true where company_id = new.id and not is_test;
  return null;
end;
$function$;

revoke execute on function public.propagate_company_is_test_to_jobs() from public, anon, authenticated;

drop trigger if exists trg_ow_companies_propagate_is_test on public.ow_companies;
create trigger trg_ow_companies_propagate_is_test
  after update of is_test on public.ow_companies
  for each row
  when (new.is_test and not coalesce(old.is_test, false))
  execute function public.propagate_company_is_test_to_jobs();

comment on function public.propagate_company_is_test_to_jobs() is
  E'ow_companies の AFTER UPDATE OF is_test トリガー。企業が is_test になったら、その企業の求人も is_test にする（2026-10-09）。\n外す方向（企業の is_test を false にする）では求人を戻さない。';

-- ── 3. 検算 ──────────────────────────────────────────────────────────────────
do $$
declare v int;
begin
  select count(*) into v
    from ow_jobs j join ow_companies c on c.id = j.company_id
   where c.is_test and not j.is_test;
  if v <> 0 then raise exception '検算失敗: 食い違いが % 件', v; end if;
  if has_function_privilege('authenticated', 'public.inherit_company_is_test_to_job()', 'EXECUTE')
     or has_function_privilege('anon', 'public.propagate_company_is_test_to_jobs()', 'EXECUTE') then
    raise exception '検算失敗: トリガー関数がクライアントのロールから実行できる';
  end if;
  raise notice '検算OK: 企業が is_test の求人はすべて is_test（食い違い 0件）';
end $$;

commit;

-- ★戻すとき:
--   drop trigger trg_ow_jobs_inherit_company_is_test on public.ow_jobs;
--   drop trigger trg_ow_companies_propagate_is_test on public.ow_companies;
--   drop function public.inherit_company_is_test_to_job();
--   drop function public.propagate_company_is_test_to_jobs();
