-- ★「つながり」として表示してよいか（2026-10-16 / 柴さんの判断。フェーズ3）
--
-- 企業ページに「この会社に、あなたのつながりがいます（N人）」を出す。
-- つながり＝閲覧者と相互フォローの人で、その会社に is_current の職歴がある人。
-- ⚠️★出すかどうかは**表示される側の本人**が決める。初期値は false（表示しない）。
--    ・人数が1人だと誰か推測されうる
--    ・転職を考えている人の在籍が、相互フォローの相手に見える
--
-- ⚠️ ow_profiles.user_id は **auth 空間**（auth.users.id）。ow_users.id ではない。
--    判定するときは ow_users.auth_id で結合する（lib/companies/connections.ts）。
-- ⚠️ 権限: ow_profiles はテーブルレベルの GRANT（authenticated に SELECT/UPDATE/INSERT）と
--    本人だけの RLS（ow_profiles_own_*）。列を足すだけで本人は読み書きでき、他人には読めない。
--    アプリは admin クライアントで読み書きする（/api/jobseeker/connection-setting）。
--
-- 追加のみ。既存の行は false で入る（推測で true にしない）。
-- 戻し方: alter table public.ow_profiles drop column show_as_connection;

alter table public.ow_profiles
  add column show_as_connection boolean not null default false;

comment on column public.ow_profiles.show_as_connection is
  '相互フォローしている人に、在籍中の企業のページで「つながり」として自分を表示してよいか。'
  '本人だけが設定する。初期値 false（2026-10-16）';

do $$
begin
  if exists (select 1 from public.ow_profiles where show_as_connection) then
    raise exception 'show_as_connection が true の行がある（初期値は false のはず）';
  end if;
end $$;
