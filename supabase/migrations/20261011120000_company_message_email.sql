-- ★企業からメッセージが届いたことを求職者にメールで知らせる（2026-10-11 / 柴さんの指示）
--
-- 追加だけ。既存の行・列・権限は変えない。
--
-- ① ow_profiles.email_company_message_enabled … 「企業からのメッセージをメールで受け取る」。既定はオン。
--    ⚠️ 既定値は src/lib/constants/emailSettings.ts の EMAIL_SETTING_DEFAULTS と同じにする。
--    ⚠️ ow_profiles の GRANT はテーブル単位なので列単位の grant は要らない（適用後に下で確かめる）。
--    ⚠️ 読み書きは /api/jobseeker/email-settings（admin クライアント）だけ。
--
-- ② ow_company_message_email_sends … 同じ会話（または同じ声かけ）について、最後にメールを送った時刻。
--    30分以内に続いて届いたものは送らず、最初の1通にまとめる（src/lib/notify/companyMessageEmail.ts）。
--    ⚠️ 運営専用（ow_transitions と同じ形）。RLS 有効・ポリシー0本・anon / authenticated に GRANT しない。
--    ⚠️ 本文は持たない（送った時刻だけ）。

alter table public.ow_profiles
  add column if not exists email_company_message_enabled boolean not null default true;

comment on column public.ow_profiles.email_company_message_enabled is
  '企業からのメッセージ（1通目・紹介で企業が会うと答えた・会話での返信）をメールで知らせるか。既定 true';

create table if not exists public.ow_company_message_email_sends (
  recipient_user_id uuid not null references public.ow_users(id) on delete cascade,
  -- 'conversation:<uuid>' か 'approach:<uuid>'
  thread_key text not null check (thread_key ~ '^(conversation|approach):[0-9a-f-]{36}$'),
  last_sent_at timestamptz not null default now(),
  primary key (recipient_user_id, thread_key)
);

comment on table public.ow_company_message_email_sends is
  '企業からのメッセージのメール通知を最後に送った時刻（30分以内はまとめる）。運営専用・本文は持たない';

alter table public.ow_company_message_email_sends enable row level security;
revoke all on table public.ow_company_message_email_sends from public, anon, authenticated;
grant select, insert, update, delete on table public.ow_company_message_email_sends to service_role;

do $$
begin
  if not has_column_privilege('authenticated', 'public.ow_profiles', 'email_company_message_enabled', 'SELECT') then
    raise exception 'authenticated が新しい列を読めない（ow_profiles の GRANT がテーブル単位でなくなっている）';
  end if;
  if has_table_privilege('anon', 'public.ow_company_message_email_sends', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_company_message_email_sends', 'SELECT') then
    raise exception 'ow_company_message_email_sends が anon / authenticated から読める';
  end if;
  if (select count(*) from public.ow_profiles where email_company_message_enabled is distinct from true) <> 0 then
    raise exception '既存の行が true で埋まっていない';
  end if;
end $$;
