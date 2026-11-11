-- ★「相談できる人」——運営が選んだ人を /people の左サイドバーに出す（2026-11-12 / 柴さんの決定）
--
-- 新しい表を1つ作るだけ。既存の表・列・データは1つも変えない。行も入れない
-- （載せる人は運営画面 /admin/consultants から登録し、本人の同意を記録してから承認する）。
--
-- ⚠️ 2026-10-16 に撤去した「面談OK（話を聞ける人）」とは別物。あちらは利用者が自分でオンにする設定で、
--    運用に乗らなかった。こちらは運営が信頼できる人を選び、本人の同意を記録して載せる（転職ルートの経験者と同じ決まり）。
--
-- 載せる条件（判定は src/lib/constants/careerRoutes.ts の consultantBlockers の1か所）:
--   ① 運営が承認済み（is_listed かつ approved_at）
--   ② 本人の同意の記録（consent_confirmed_at と consent_method）がある
--   ③ 公開範囲が「非公開」でない（/people はログインが要る画面なので「ログインユーザーのみ」でよい）
--   ＋ 本人が登録している・検証用でない・システムでない
--
-- ⚠️ talk_tags と consent_method の選択肢は src/lib/constants/careerRoutes.ts の
--    ROUTE_TALK_TAGS / ROUTE_CONSENT_METHODS と同じ（転職ルートの経験者とそろえる。テストが突き合わせる）。
--
-- 権限: RLS 有効・ポリシー0本・anon / authenticated に権限なし（ow_route_hosts と同じ形）。
--       読み書きはサーバーの admin クライアントだけ。
--
-- 戻し方: drop table public.ow_featured_consultants;（他の表から参照されていない）

begin;

create table public.ow_featured_consultants (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references public.ow_users(id) on delete cascade,
  talk_tags            text[] not null default '{}'
                       check (talk_tags <@ array[
                         'newcomer_rampup','interview','resume','salary_negotiation',
                         'english','foreign_eval_quota','workstyle_remote','role_change'
                       ]::text[]),
  message              text check (message is null or char_length(message) <= 200),
  display_order        integer not null default 0,
  is_listed            boolean not null default false,
  approved_at          timestamptz,
  approved_by          uuid references public.ow_users(id) on delete set null,
  consent_confirmed_at timestamptz,
  consent_method       text check (consent_method is null or consent_method in ('email', 'line', 'meeting', 'other')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint ow_featured_consultants_listed_requires_approval check (is_listed = false or approved_at is not null),
  constraint ow_featured_consultants_consent_pair check ((consent_confirmed_at is null) = (consent_method is null)),
  constraint ow_featured_consultants_consent_required check (is_listed = false or consent_confirmed_at is not null)
);

comment on table public.ow_featured_consultants is
  '「相談できる人」（/people の左サイドバー）。運営が選び、本人の同意を記録して承認した人だけを出す。読み書きは admin クライアントのみ';
comment on column public.ow_featured_consultants.talk_tags is
  '話せること。値は src/lib/constants/careerRoutes.ts の ROUTE_TALK_TAGS と同じ（CHECK と揃える）';
comment on column public.ow_featured_consultants.consent_confirmed_at is
  '本人の同意を運営が確認した日時。承認（is_listed）にはこれと consent_method が要る';
comment on column public.ow_featured_consultants.consent_method is
  '同意を確認した方法（email / line / meeting / other）。値は ROUTE_CONSENT_METHODS と同じ';

alter table public.ow_featured_consultants enable row level security;
revoke all on public.ow_featured_consultants from public, anon, authenticated;
grant all on public.ow_featured_consultants to service_role;

-- ★検算: anon / authenticated から読めないこと
do $$
begin
  if has_table_privilege('anon', 'public.ow_featured_consultants', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_featured_consultants', 'SELECT') then
    raise exception 'ow_featured_consultants に一般の権限が残っている';
  end if;
end $$;

commit;
