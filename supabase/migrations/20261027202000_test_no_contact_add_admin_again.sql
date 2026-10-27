-- ★検証用: 【テスト】担当者なし株式会社 に contact+50（検証用）を担当者として登録する（2026-10-27 / 「知らせてほしい」の検証。柴さんの指示）
--   担当者が付いたら「参加したら知らせる」を押した本人に知らせ、名前は届かないことを確かめる。検証のあと id で消す。
-- 作業前ダンプ: .dumps/20261027-1839-ow_companies-ow_company_admins-ow_company_join_notices.sql（ow_company_admins 25行）
-- 戻し方: delete from ow_company_admins where id = 'e4b8a2d6-1c3f-4e5a-8b7d-9f2a0c6e3b51';
do $$
begin
  if (select count(*) from ow_company_admins) <> 25 then raise exception '想定外: ow_company_admins の件数'; end if;
  if exists (select 1 from ow_company_admins where user_id = '7958ca06-88c8-41f8-aab7-3cd784718e7e') then
    raise exception 'contact+50 は既にどこかの担当者';
  end if;
  insert into ow_company_admins (id, company_id, user_id, permission, is_active, created_via, accepted_at, joined_at)
  values ('e4b8a2d6-1c3f-4e5a-8b7d-9f2a0c6e3b51', 'b7c1e0a4-5d2f-4c8e-9a31-6f0d2e4b7a19', '7958ca06-88c8-41f8-aab7-3cd784718e7e',
          'admin', true, 'admin', now(), now());
end $$;
