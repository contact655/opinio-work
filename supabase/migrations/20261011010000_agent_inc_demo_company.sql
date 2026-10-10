-- ════════════════════════════════════════════════════════════════════════
-- 株式会社エージェントを検証用・デモ用の企業にする（2026-10-11 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★柴さんの別会社で、どんなデータを作ってもよいと確認が取れている。
-- ★作業前の控え: .dumps/20261011-0108-ow_companies.sql / .dumps/20261011-0108-ow_company_admins.sql
--
-- ① is_test = true … 企業ページ（404 になる）・一覧・検索・sitemap・職歴の会社選択から外れる。
--    ⚠️ 元から非掲載（listing_status='draft'）なので一覧・sitemap は変わらない。変わるのは企業ページだけ。
--    ⚠️ 職歴・求人・提案・声かけ・会話・フォロー・フィード投稿の参照は0件（2026-10-11 実測）。
--    ⚠️ 求人へは trg_ow_companies_propagate_is_test が引き継ぐ（いま0件）。
-- ② hshiba@opinio.co.jp（検証用）を担当者に足す … /biz の会社切り替えから入れるようにする。
--    ⚠️ 既存の担当者（d1872303951587@gmail.com・検証用）はそのまま。
--
-- 見本のデータはここに入れない。`scripts/demo-agent.mjs`（作る／消す）で入れる。
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
declare n int;
begin
  update public.ow_companies set is_test = true
   where id = '7a048a8e-2c44-4f09-a727-8d7e6350851c' and name = '株式会社エージェント' and is_test = false;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '想定外: エージェントの is_test 更新が % 行', n; end if;

  insert into public.ow_company_admins (user_id, company_id, permission, is_active, created_via)
  select 'fe7dfe9b-75d4-4a75-a821-fa1a9599a416', '7a048a8e-2c44-4f09-a727-8d7e6350851c', 'admin', true, 'admin'
   where exists (select 1 from public.ow_users where id = 'fe7dfe9b-75d4-4a75-a821-fa1a9599a416' and email = 'hshiba@opinio.co.jp' and is_test)
  on conflict (user_id, company_id) do update set is_active = true;

  -- 検算
  if (select count(*) from public.ow_company_admins a join public.ow_users u on u.id = a.user_id
       where a.company_id = '7a048a8e-2c44-4f09-a727-8d7e6350851c' and a.is_active and not u.is_test) <> 0 then
    raise exception '検算失敗: エージェントに検証用でない担当者がいる';
  end if;
  if not exists (select 1 from public.ow_company_admins
                  where company_id = '7a048a8e-2c44-4f09-a727-8d7e6350851c' and user_id = 'fe7dfe9b-75d4-4a75-a821-fa1a9599a416' and is_active) then
    raise exception '検算失敗: hshiba が担当者に入っていない';
  end if;
  raise notice '検算OK';
end $$;

commit;

-- ★戻すとき:
--   update ow_companies set is_test = false where id = '7a048a8e-2c44-4f09-a727-8d7e6350851c';
--   delete from ow_company_admins where company_id = '7a048a8e-2c44-4f09-a727-8d7e6350851c' and user_id = 'fe7dfe9b-75d4-4a75-a821-fa1a9599a416';
