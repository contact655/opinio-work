-- ★「保存」の検証で作った行を id で片づけ、検証用の会社を下書きに戻す（2026-10-27 / 柴さんの指示）
--   ・通知 2d3b4a4a（interest_company_joined。contact+25 宛て）
--   ・保存 74d1da5d（contact+25 × 【テスト】担当者なし株式会社）
--   ・ow_company_admins f1c3e5a7（contact+50。検証用の担当者）
-- 作業前ダンプ: .dumps/20261027-2319-ow_company_admins-ow_bookmarks-ow_notifications.sql
-- ⚠️ 【テスト】担当者なし株式会社 は消さない（listing_status を 'draft' に戻すだけ）
do $$
declare n int;
begin
  delete from ow_notifications where id = '2d3b4a4a-aa43-4a2a-837a-c4f85a51f898';
  get diagnostics n = row_count; if n <> 1 then raise exception 'notifications: %', n; end if;
  delete from ow_bookmarks where id = '74d1da5d-299f-45b0-9e89-db9301754c13';
  get diagnostics n = row_count; if n <> 1 then raise exception 'bookmarks: %', n; end if;
  delete from ow_company_admins where id = 'f1c3e5a7-2b4d-4f6a-8c9e-0a1b2c3d4e5f';
  get diagnostics n = row_count; if n <> 1 then raise exception 'admins: %', n; end if;
  update ow_companies set listing_status = 'draft' where id = 'b7c1e0a4-5d2f-4c8e-9a31-6f0d2e4b7a19' and is_test;
  get diagnostics n = row_count; if n <> 1 then raise exception 'company draft: %', n; end if;
end $$;
