-- ★検証用: 【テスト】担当者なし株式会社 に contact+50（検証用）を担当者として登録する（2026-10-27 / 「保存」の検証。柴さんの指示）
--   保存した人に「送れるようになりました」が届き、名前は届かないことを確かめる。検証のあと id で消す。
-- 戻し方: delete from ow_company_admins where id = 'f1c3e5a7-2b4d-4f6a-8c9e-0a1b2c3d4e5f';
do $$
begin
  if (select count(*) from ow_company_admins) <> 25 then raise exception '想定外: ow_company_admins の件数'; end if;
  if exists (select 1 from ow_company_admins where user_id = '7958ca06-88c8-41f8-aab7-3cd784718e7e') then
    raise exception 'contact+50 は既にどこかの担当者';
  end if;
  insert into ow_company_admins (id, company_id, user_id, permission, is_active, created_via, accepted_at, joined_at)
  values ('f1c3e5a7-2b4d-4f6a-8c9e-0a1b2c3d4e5f', 'b7c1e0a4-5d2f-4c8e-9a31-6f0d2e4b7a19', '7958ca06-88c8-41f8-aab7-3cd784718e7e',
          'admin', true, 'admin', now(), now());
end $$;
