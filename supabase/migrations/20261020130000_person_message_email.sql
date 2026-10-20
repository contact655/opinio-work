-- ★個人どうしのメッセージが届いたことを、メールでも知らせる（2026-10-20 / 柴さんの判断）
--
-- 追加だけ。既存の行・列・権限は変えない。
--
-- ow_profiles.email_person_message_enabled … 「個人からのメッセージをメールで受け取る」。既定はオン。
--   ⚠️ 既定値は src/lib/constants/emailSettings.ts の EMAIL_SETTING_DEFAULTS と同じにする。
--   ⚠️ ow_profiles の GRANT はテーブル単位なので列単位の grant は要らない（下で確かめる）。
--   ⚠️ 読み書きは /api/jobseeker/email-settings（admin クライアント）だけ。
--
-- ⚠️ 30分以内に続いたものをまとめる記録は、企業からのメッセージと同じ ow_company_message_email_sends を使う
--    （thread_key は 'conversation:<会話の id>'。個人どうしの会話の id も同じ形なので CHECK はそのまま通る）。
--
-- 戻し方: alter table public.ow_profiles drop column email_person_message_enabled;
--         （src/lib/notify/personMessageEmail.ts と設定の項目も一緒に外すこと）

alter table public.ow_profiles
  add column if not exists email_person_message_enabled boolean not null default true;

comment on column public.ow_profiles.email_person_message_enabled is
  '個人からのメッセージ（最初の1通・返信・つながりからのメッセージ）をメールで知らせるか。既定 true';

do $$
begin
  if not has_column_privilege('authenticated', 'public.ow_profiles', 'email_person_message_enabled', 'SELECT') then
    raise exception 'authenticated が新しい列を読めない（ow_profiles の GRANT がテーブル単位でなくなっている）';
  end if;
  if (select count(*) from public.ow_profiles where email_person_message_enabled is distinct from true) <> 0 then
    raise exception '既存の行が true で埋まっていない';
  end if;
end $$;
