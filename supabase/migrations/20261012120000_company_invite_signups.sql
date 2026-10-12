-- ★会社ごとの招待リンク（/join/<slug>）から登録した人の記録（2026-10-12 / 柴さんの指示）。
--   運営画面（/admin/companies）の「招待からの登録 n名」にだけ使う。**企業側の画面には出さない**（個人が特定されやすいため）。
-- ★権限は ow_proposals と同じ形: RLS 有効・ポリシー0本・anon / authenticated に GRANT なし。読み書きは admin クライアントだけ。
-- ⚠️ 1人1社につき1行（同じ人が何度リンクを開いても数は増えない）。
create table public.ow_company_invite_signups (
  company_id  uuid not null references public.ow_companies(id) on delete cascade,
  ow_user_id  uuid not null references public.ow_users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (company_id, ow_user_id)
);
comment on table public.ow_company_invite_signups is
  '会社の招待リンク（/join/<slug>）から登録した人。運営画面の件数だけに使う（企業には出さない）。admin クライアントだけ。2026-10-12';
alter table public.ow_company_invite_signups enable row level security;
revoke all on public.ow_company_invite_signups from anon, authenticated, public;
do $$
begin
  if has_table_privilege('authenticated', 'public.ow_company_invite_signups', 'SELECT')
     or has_table_privilege('anon', 'public.ow_company_invite_signups', 'SELECT') then
    raise exception '招待の記録にクライアントの権限がある。中止';
  end if;
end $$;
