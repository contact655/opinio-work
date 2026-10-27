-- ★「知らせてほしい」の検証で作った行を id で片づける（2026-10-27 / 柴さんの指示。検証は途中で止めた）
--   ・通知 10abbd2c（interest_company_joined。contact+25 宛て）
--   ・ow_company_join_notices（contact+25 × 【テスト】担当者なし株式会社）
--   ・ow_company_admins e4b8a2d6（contact+50。検証用の担当者）
-- ⚠️ 会社は掲載のまま（続けて「保存」の検証に使う）。最後に draft に戻す。
do $$
declare n int;
begin
  delete from ow_notifications where id = '10abbd2c-1d5b-4a46-b89c-8669b13ace77';
  get diagnostics n = row_count; if n <> 1 then raise exception 'notifications: %', n; end if;
  delete from ow_company_join_notices where user_id = 'b0968ba2-b855-4b6d-81c2-56dac0584668' and company_id = 'b7c1e0a4-5d2f-4c8e-9a31-6f0d2e4b7a19';
  get diagnostics n = row_count; if n <> 1 then raise exception 'join notices: %', n; end if;
  delete from ow_company_admins where id = 'e4b8a2d6-1c3f-4e5a-8b7d-9f2a0c6e3b51';
  get diagnostics n = row_count; if n <> 1 then raise exception 'admins: %', n; end if;
end $$;
