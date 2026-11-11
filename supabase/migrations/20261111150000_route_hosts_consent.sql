-- ★転職ルートの経験者に「本人の同意を確認した記録」を持たせる（2026-11-11 / 柴さんの指示）
--
-- ow_route_hosts に2列を足し、相談の受付（accepting_consult = true）と掲載の承認（is_listed = true）は
-- 同意の記録が2つともそろっていないと保存できないようにする。
--
--   consent_confirmed_at … 本人の同意を運営が確認した日時
--   consent_method       … 確認した方法（email / line / meeting / other）
--
-- ⚠️ 選択肢は src/lib/constants/careerRoutes.ts の ROUTE_CONSENT_METHODS と同じ。片方だけ変えないこと
--    （UI / API / DB の CHECK を3つ揃える。テストが突き合わせる）。
-- ⚠️ 2列はそろって入るか、そろって空か（片方だけの記録を作らない）。
-- ⚠️ 既存の行: 2026-11-11 時点で ow_route_hosts は0行。下の検算で、適用前に制約を破る行が無いことを確かめる。
--
-- 戻し方:
--   alter table public.ow_route_hosts
--     drop constraint ow_route_hosts_consent_required,
--     drop constraint ow_route_hosts_consent_pair,
--     drop column consent_method,
--     drop column consent_confirmed_at;

begin;

-- ★検算: 適用前に、相談の受付か掲載が true の行が無いこと（あれば同意の記録が無いまま true になっている）
do $$
declare n integer;
begin
  select count(*) into n from public.ow_route_hosts where accepting_consult or is_listed;
  if n > 0 then
    raise exception '同意の記録が無いまま相談の受付・掲載が true の行が % 件ある。先に確かめること', n;
  end if;
end $$;

alter table public.ow_route_hosts
  add column consent_confirmed_at timestamptz,
  add column consent_method text
    check (consent_method is null or consent_method in ('email', 'line', 'meeting', 'other')),
  add constraint ow_route_hosts_consent_pair
    check ((consent_confirmed_at is null) = (consent_method is null)),
  add constraint ow_route_hosts_consent_required
    check ((accepting_consult = false and is_listed = false)
           or (consent_confirmed_at is not null and consent_method is not null));

comment on column public.ow_route_hosts.consent_confirmed_at is
  '本人の同意を運営が確認した日時。相談の受付・掲載の承認にはこれと consent_method が要る';
comment on column public.ow_route_hosts.consent_method is
  '同意を確認した方法（email / line / meeting / other）。値は src/lib/constants/careerRoutes.ts の ROUTE_CONSENT_METHODS と同じ';

-- ★検算: 権限が増えていないこと（列を足しても anon / authenticated に読ませない）
do $$
begin
  if has_table_privilege('anon', 'public.ow_route_hosts', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_route_hosts', 'SELECT') then
    raise exception 'ow_route_hosts に一般の権限が残っている';
  end if;
end $$;

commit;
