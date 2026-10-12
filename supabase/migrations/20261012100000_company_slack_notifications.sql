-- ★会社ごとの Slack 通知（2026-10-12 / 柴さんの指示）。
--   ow_company_slack_settings … 会社1社につき1行。Incoming Webhook の URL・通知する種類・名前を含めるか・失敗の記録
--   ow_company_slack_sends    … 30分まとめ（同じ会社・同じ件について、30分以内に続いたものは送らない）
--
-- ★権限は ow_proposals と同じ形: RLS 有効・ポリシー0本・anon / authenticated に GRANT なし。
--   読み書きはサーバーの admin クライアントだけ。会社の管理者かどうかはルート側（getTenantContext の
--   currentPermission = 'admin'）で確かめる。
--   ⚠️★Webhook の URL は秘密（知っていれば誰でもそのチャンネルに投稿できる）。ブラウザには末尾だけ返す。
--      ポリシーを足して authenticated に開けないこと（URL が PostgREST から読めるようになる）。
--   ⚠️ URL は https://hooks.slack.com/ で始まるものだけ（CHECK。画面と API でも同じ判定）。

begin;

create table public.ow_company_slack_settings (
  company_id              uuid primary key references public.ow_companies(id) on delete cascade,
  webhook_url             text,
  notify_reply            boolean not null default true,
  notify_meeting          boolean not null default true,
  notify_application      boolean not null default true,
  include_candidate_name  boolean not null default false,
  consecutive_failures    integer not null default 0,
  last_error_at           timestamptz,
  last_error_status       integer,
  last_success_at         timestamptz,
  paused_at               timestamptz,
  updated_by_ow_user_id   uuid references public.ow_users(id) on delete set null,
  updated_at              timestamptz not null default now(),
  constraint ow_company_slack_settings_url_check
    check (webhook_url is null or webhook_url ~ '^https://hooks\.slack\.com/[A-Za-z0-9/_-]+$')
);

comment on table public.ow_company_slack_settings is
  '会社ごとの Slack 通知の設定（Incoming Webhook）。URL は秘密。読み書きは admin クライアントだけ（RLS ポリシー0本・GRANT なし）。2026-10-12';

create table public.ow_company_slack_sends (
  company_id    uuid not null references public.ow_companies(id) on delete cascade,
  thread_key    text not null,
  last_sent_at  timestamptz not null default now(),
  primary key (company_id, thread_key)
);

comment on table public.ow_company_slack_sends is
  'Slack 通知の30分まとめ（会社 × 件ごとの最後に送った時刻）。admin クライアントだけ。2026-10-12';

alter table public.ow_company_slack_settings enable row level security;
alter table public.ow_company_slack_sends enable row level security;
revoke all on public.ow_company_slack_settings from anon, authenticated, public;
revoke all on public.ow_company_slack_sends from anon, authenticated, public;

do $$
begin
  if has_table_privilege('authenticated', 'public.ow_company_slack_settings', 'SELECT')
     or has_table_privilege('anon', 'public.ow_company_slack_settings', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_company_slack_sends', 'SELECT') then
    raise exception 'Slack の設定にクライアントの権限がある。中止';
  end if;
end $$;

commit;
