-- ★転職ルート（/routes/[slug]）と、そのルートの経験者（2026-11-11 / 柴さんの決定）
--
-- 新しい表を2つ作るだけ。既存の表・列・データは1つも変えない。
--
--   ow_career_routes … ルートのマスタ（「人材の法人営業 → 外資SaaSの営業」など）。表示名は自由な文字で持つ
--                      （職種・業界のマスタには結びつけない。運営が手で決める）
--   ow_route_hosts   … そのルートを経験した人の登録。運営が経歴を目で確かめて承認する
--
-- 掲載の条件（3つすべて。判定は src/lib/careerRoutes/listable.ts の1か所）:
--   ① ow_users.visibility = 'public'
--   ② ow_route_hosts.accepting_consult = true（本人の同意を運営が確かめて入れる）
--   ③ ow_route_hosts.is_listed = true（運営が承認済み）
--   ⚠️ 相談の受付は ow_talk_settings を使わない。2026-11-05 に「話を聞ける」設定ごと外したため（戻さないこと）。
--      この列はルートの経験者にだけ効く。
--
-- 権限: RLS 有効・ポリシー0本・anon / authenticated に権限なし（ow_transitions と同じ形）。
--       読み書きはサーバーの admin クライアントだけ。
--
-- ⚠️ talk_tags の選択肢は src/lib/constants/careerRoutes.ts の ROUTE_TALK_TAGS と同じ。片方だけ変えないこと
--    （UI / API / DB の CHECK を3つ揃える）。足すときは CHECK を張り替える。
--
-- 戻し方: drop table public.ow_route_hosts; drop table public.ow_career_routes;（どちらも他の表から参照されていない）

begin;

create table public.ow_career_routes (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  from_label    text not null check (char_length(btrim(from_label)) between 1 and 60),
  to_label      text not null check (char_length(btrim(to_label)) between 1 and 60),
  display_order integer not null default 0,
  is_published  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.ow_career_routes is
  '転職ルート（/routes/[slug]）。運営が作る。is_published かつ掲載条件を満たす経験者が1人以上のときだけページに中身が出る。読み書きは admin クライアントのみ';

create table public.ow_route_hosts (
  id                uuid primary key default gen_random_uuid(),
  route_id          uuid not null references public.ow_career_routes(id) on delete cascade,
  user_id           uuid not null references public.ow_users(id) on delete cascade,
  moved_year        integer check (moved_year is null or moved_year between 1970 and 2100),
  talk_tags         text[] not null default '{}'
                    check (talk_tags <@ array[
                      'newcomer_rampup','interview','resume','salary_negotiation',
                      'english','foreign_eval_quota','workstyle_remote','role_change'
                    ]::text[]),
  message           text check (message is null or char_length(message) <= 200),
  accepting_consult boolean not null default false,
  is_listed         boolean not null default false,
  approved_at       timestamptz,
  approved_by       uuid references public.ow_users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (route_id, user_id),
  constraint ow_route_hosts_listed_requires_approval check (is_listed = false or approved_at is not null)
);

create index ow_route_hosts_user_id_idx on public.ow_route_hosts (user_id);

comment on table public.ow_route_hosts is
  '転職ルートの経験者。運営が経歴を確かめて承認する（is_listed）。accepting_consult は本人の同意を運営が確かめて入れる。読み書きは admin クライアントのみ';
comment on column public.ow_route_hosts.talk_tags is
  '話せること。値は src/lib/constants/careerRoutes.ts の ROUTE_TALK_TAGS と同じ（CHECK と揃える）';
comment on column public.ow_route_hosts.accepting_consult is
  '相談を受け付けるか。ow_talk_settings は使わない（2026-11-05 に外した）。ルートの経験者にだけ効く';

alter table public.ow_career_routes enable row level security;
alter table public.ow_route_hosts enable row level security;

revoke all on public.ow_career_routes from public, anon, authenticated;
revoke all on public.ow_route_hosts from public, anon, authenticated;
grant all on public.ow_career_routes to service_role;
grant all on public.ow_route_hosts to service_role;

-- ★検算: anon / authenticated から読めないこと
do $$
begin
  if has_table_privilege('anon', 'public.ow_career_routes', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_career_routes', 'SELECT')
     or has_table_privilege('anon', 'public.ow_route_hosts', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_route_hosts', 'SELECT') then
    raise exception 'ow_career_routes / ow_route_hosts に一般の権限が残っている';
  end if;
end $$;

commit;
