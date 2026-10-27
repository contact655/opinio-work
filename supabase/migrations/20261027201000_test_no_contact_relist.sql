-- ★検証用: 【テスト】担当者なし株式会社 を検証のあいだだけ掲載に戻す（2026-10-27 / 「知らせてほしい」の検証。柴さんの指示）
--   検証が終わったら draft に戻す（消さない）。担当者はいない状態（ow_company_admins 0行）から始める。
-- 戻し方: update ow_companies set listing_status = 'draft' where id = 'b7c1e0a4-5d2f-4c8e-9a31-6f0d2e4b7a19';
do $$
declare n int;
begin
  if exists (select 1 from ow_company_admins where company_id = 'b7c1e0a4-5d2f-4c8e-9a31-6f0d2e4b7a19') then
    raise exception '担当者が残っている';
  end if;
  update ow_companies set listing_status = 'listed'
   where id = 'b7c1e0a4-5d2f-4c8e-9a31-6f0d2e4b7a19' and is_test and is_approved and is_published;
  get diagnostics n = row_count; if n <> 1 then raise exception '更新 % 行', n; end if;
end $$;
