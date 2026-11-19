-- ════════════════════════════════════════════════════════════════════════
-- Next Manager: 個人の申告で「採用中」にできるようにする（2026-11-19 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- 2026-11-13 の論点A（採用中は会社の有効な担当者だけ）を変える。柴さんの決定（2026-11-19）:
--   ① 名乗れるのは「現職の会社」だけ（ow_experiences の is_current かつ company_id がその会社）。
--      会社名の自由入力は受けない。
--   ② 担当者でない人のマッチングの記録は「本人だけ」が見る。会社の候補者管理には出さない
--      （ow_manager_matches.self_declared = true の行は listCompanyMatches が落とす）。
--   ③ なりすましへの備え: 一覧に「本人の申告」と出す／その会社の管理者が外せる／運営の一覧で外せる。
--      外されたら、本人はその会社でもう一度オンにできない（外した意味が無くなるため）。
--
-- ⚠️ 会社の担当者（ow_company_admins の有効な行）は、これまでどおり ow_company_admins.is_hiring を使う。
--    この表は「その会社の担当者でない人」だけのもの（アプリが振り分ける。lib/nextManager/server.ts）。
-- ⚠️ 申告した人は募集に紐づけない（求人ページの「この募集の Hiring Manager」は会社の担当者だけ）。
-- ⚠️ 現職でなくなったら（職歴を終えた・消した）、行が残っていても表示しない（読むときに職歴を確かめる）。
-- ⚠️ 表は anon / authenticated に権限なし・ポリシー0本。読み書きは API（service role）だけ。
--
-- 既存のデータは変えない（新しい表と、既定値 false の列を1つ足すだけ）。
--
-- 戻し方:
--   alter table public.ow_manager_matches drop column self_declared;
--   drop table public.ow_self_hiring;
-- ════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. 個人の申告の「採用中」 ─────────────────────────────────────────────
create table public.ow_self_hiring (
  user_id          uuid not null references public.ow_users(id) on delete cascade,
  company_id       uuid not null references public.ow_companies(id) on delete cascade,
  is_hiring        boolean not null default false,
  -- ⚠️ 長さは lib/nextManager/constants.ts の HIRING_NOTE_MAX と同じ（ow_company_admins.hiring_note と同じ）
  note             text check (note is null or char_length(note) between 1 and 40),
  -- 会社の管理者か運営が外した。⚠️ 外されたら本人はこの会社でオンに戻せない
  removed_at       timestamptz,
  removed_by       uuid references public.ow_users(id) on delete set null,
  removed_by_role  text check (removed_by_role in ('company', 'ops')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, company_id),
  constraint ow_self_hiring_removed_not_hiring check (removed_at is null or is_hiring = false),
  constraint ow_self_hiring_removed_role check ((removed_at is null) = (removed_by_role is null))
);
create index ow_self_hiring_company_idx on public.ow_self_hiring(company_id) where is_hiring;
comment on table public.ow_self_hiring is
  'Next Manager の「採用中」のうち、会社の担当者でない人の申告（2026-11-19）。現職の会社だけ。会社の管理者と運営が外せる。読み書きは API（service role）だけ。anon / authenticated に GRANT しない・ポリシーを書かない。';

alter table public.ow_self_hiring enable row level security;
revoke all on table public.ow_self_hiring from public, anon, authenticated;
grant select, insert, update, delete on table public.ow_self_hiring to service_role;

-- ── 2. マッチングの記録: 申告した人の記録は本人だけのもの ─────────────────────
alter table public.ow_manager_matches
  add column self_declared boolean not null default false;
comment on column public.ow_manager_matches.self_declared is
  '申告した人（会社の担当者でない人）の記録（2026-11-19）。true の行は会社の候補者管理に出さない・引き継がない。本人だけが会話の欄で見る。';

-- ── 3. 適用の中で確かめる ───────────────────────────────────────────────
do $$
begin
  if has_table_privilege('anon', 'public.ow_self_hiring', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_self_hiring', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_self_hiring', 'INSERT')
     or has_table_privilege('authenticated', 'public.ow_self_hiring', 'UPDATE')
     or has_table_privilege('authenticated', 'public.ow_self_hiring', 'DELETE') then
    raise exception 'ow_self_hiring にクライアントのロールの権限が残っている';
  end if;
  if (select count(*) from pg_policy where polrelid = 'public.ow_self_hiring'::regclass) <> 0 then
    raise exception 'ow_self_hiring にポリシーがある（0本のはず）';
  end if;
  -- 既存の記録はすべて会社の担当者のもの
  if exists (select 1 from public.ow_manager_matches where self_declared) then
    raise exception 'self_declared が立っている記録がある（既定は false のはず）';
  end if;
end $$;

commit;
