-- ★検証用: 【テスト】担当者なし株式会社 に contact+50（検証用・どの会社の担当者でもない）を担当者として登録する
--   （2026-10-27 / 話を聞きたい人 フェーズ1a・柴さんの指示）
--
-- 目的: 担当者が登録されたら、押してから90日以内の「話を聞いてみたい」が届くことを確かめる。
--       画面の招待の流れは、この会社に招待を送れる担当者がいないので使えない。そのため SQL で入れる。
-- ⚠️ 届ける処理はアプリ側（担当者の承諾・参加依頼の承認・再有効化の直後と、日次の /api/cron/interest-followup）。
--    この migration では届けない。適用後に日次の確認を1回手で呼ぶ。
-- 作業前ダンプ: .dumps/20261027-1822-ow_company_admins-…sql（ow_company_admins 25行）
-- 戻し方: delete from ow_company_admins where id = 'd2a6f4c1-8e3b-4b7a-9c55-1f0e7a3b2c48';

do $$
declare
  v_id constant uuid := 'd2a6f4c1-8e3b-4b7a-9c55-1f0e7a3b2c48';
  v_company constant uuid := 'b7c1e0a4-5d2f-4c8e-9a31-6f0d2e4b7a19';
  v_user constant uuid := '7958ca06-88c8-41f8-aab7-3cd784718e7e'; -- contact+50@opinio.co.jp
begin
  if (select count(*) from ow_company_admins) <> 25 then raise exception '想定外: ow_company_admins の件数'; end if;
  if not exists (select 1 from ow_users where id = v_user and email = 'contact+50@opinio.co.jp' and is_test) then
    raise exception 'contact+50 が検証用でない／見つからない';
  end if;
  if not exists (select 1 from ow_companies where id = v_company and is_test) then raise exception '会社が検証用でない'; end if;
  if exists (select 1 from ow_company_admins where user_id = v_user) then raise exception 'contact+50 は既にどこかの担当者'; end if;

  insert into ow_company_admins (id, company_id, user_id, permission, is_active, created_via, accepted_at, joined_at)
  values (v_id, v_company, v_user, 'admin', true, 'admin', now(), now());

  if (select count(*) from ow_company_admins) <> 26 then raise exception '件数が合わない'; end if;
end $$;
