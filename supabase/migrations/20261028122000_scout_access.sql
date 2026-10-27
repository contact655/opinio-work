-- ════════════════════════════════════════════════════════════════════════════
-- スカウト（企業から最初のメッセージを送る＝/biz/messages）と候補者検索を、企業ごとに許可する（2026-10-28）
--
-- ★状態（画面の言葉）と、DB での表し方
--   未申請   … ow_company_scout_access に行が無い、かつ未対応の依頼が無い
--   申請中   … ow_scout_access_requests に resolved_at IS NULL の行がある（1社1件まで）
--   利用可   … ow_company_scout_access.status = 'granted'
--   取り消し … ow_company_scout_access.status = 'revoked'（もう一度依頼できる）
--   ⚠️ 却下は依頼の行の outcome = 'declined'。アクセスの行は作らない（＝未申請に戻る）
--
-- ★ow_company_plans は使わない（契約の履歴の表で、許可の状態を混ぜると /admin/plans の意味が変わる）
-- ★それまでの条件（is_approved ＋ プランで候補者検索が使えること）から移す。
--   引き継ぐのは「承認済みで、有効な担当者がいる会社」8社（実在4・検証用4。2026-10-28 実測）。id を明示する。
-- ⚠️ 読み書きは admin クライアントだけ（RLS 有効・ポリシー0本・anon / authenticated に権限なし）。
-- ════════════════════════════════════════════════════════════════════════════

begin;

create table public.ow_company_scout_access (
  company_id    uuid primary key references public.ow_companies(id) on delete cascade,
  status        text not null check (status in ('granted', 'revoked')),
  source        text not null check (source in ('request', 'admin', 'migration')),
  granted_at    timestamptz,
  granted_by    uuid references public.ow_users(id) on delete set null,
  revoked_at    timestamptz,
  revoked_by    uuid references public.ow_users(id) on delete set null,
  revoke_reason text check (revoke_reason is null or char_length(revoke_reason) <= 1000),
  updated_at    timestamptz not null default now(),
  constraint ow_company_scout_access_granted_at check (status <> 'granted' or granted_at is not null),
  constraint ow_company_scout_access_revoked_at check (status <> 'revoked' or revoked_at is not null)
);

comment on table public.ow_company_scout_access is
  '企業ごとのスカウト（企業から最初のメッセージ）と候補者検索の利用許可。行が無い = 未申請。運営専用';

create table public.ow_scout_access_requests (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.ow_companies(id) on delete cascade,
  requested_by   uuid references public.ow_users(id) on delete set null,
  message        text check (message is null or char_length(message) <= 500),
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    uuid references public.ow_users(id) on delete set null,
  outcome        text check (outcome in ('granted', 'declined', 'withdrawn')),
  decline_reason text check (decline_reason is null or char_length(decline_reason) <= 1000),
  constraint ow_scout_access_requests_resolved check ((resolved_at is null) = (outcome is null))
);

-- 二重に依頼させない（未対応は1社1件）
create unique index ow_scout_access_requests_one_open
  on public.ow_scout_access_requests (company_id) where resolved_at is null;
create index ow_scout_access_requests_company_idx
  on public.ow_scout_access_requests (company_id, created_at desc);

comment on table public.ow_scout_access_requests is
  '企業からの「スカウト機能の利用を依頼する」。未対応は resolved_at IS NULL。運営専用';

alter table public.ow_company_scout_access  enable row level security;
alter table public.ow_scout_access_requests enable row level security;
revoke all on public.ow_company_scout_access  from anon, authenticated;
revoke all on public.ow_scout_access_requests from anon, authenticated;

-- ── 引き継ぎ（いま候補者検索とメッセージを使える会社）─────────────────────
do $$
declare
  ids uuid[] := array[
    'cf44d740-b835-454d-91a3-f1e2eddc7251',  -- 株式会社Opinio
    'c3664ef1-5571-4645-b30f-1474e7961c17',  -- 株式会社セールスフォース・ジャパン
    '7a048a8e-2c44-4f09-a727-8d7e6350851c',  -- 株式会社エージェント
    'ef7e9028-d8f7-4668-a630-6affbaa5754a',  -- 株式会社COIN
    '69c3286a-4425-4cc3-b3f4-ae5866cb74e5',  -- 株式会社テスト（検証用）
    '81cae8d8-38bf-4497-8fa1-1fbb2741239d',  -- 【テスト】株式会社Third Box（検証用）
    'b9a3b7e2-15b0-4c70-8993-1d2f5d445934',  -- 株式会社ZAP（検証用）
    'ce44864d-5e66-4684-8723-29282e3d6f5c'   -- 【テスト】株式会社サンプルワークス（検証用）
  ]::uuid[];
  n int;
begin
  /* 想定と違えば中止（承認済み・有効な担当者がいる会社が、ちょうどこの8社であること） */
  select count(*) into n from ow_companies c
   where c.is_approved
     and exists (select 1 from ow_company_admins a where a.company_id = c.id and a.is_active);
  if n <> 8 then raise exception '対象が8社でない（%社）。中止', n; end if;
  if (select count(*) from ow_companies c
       where c.id = any(ids) and c.is_approved
         and exists (select 1 from ow_company_admins a where a.company_id = c.id and a.is_active)) <> 8 then
    raise exception '列挙した8社が条件に合わない。中止';
  end if;

  insert into ow_company_scout_access (company_id, status, source, granted_at)
  select unnest(ids), 'granted', 'migration', now();

  if (select count(*) from ow_company_scout_access) <> 8 then raise exception '引き継ぎが8件でない'; end if;
end $$;

do $$
begin
  if has_table_privilege('authenticated', 'public.ow_company_scout_access', 'SELECT')
     or has_table_privilege('anon', 'public.ow_company_scout_access', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_scout_access_requests', 'SELECT')
     or has_table_privilege('anon', 'public.ow_scout_access_requests', 'SELECT') then
    raise exception 'anon / authenticated に権限が付いている';
  end if;
end $$;

commit;

-- 戻し方: drop table ow_scout_access_requests; drop table ow_company_scout_access;
--         （アプリを is_approved ＋ プランの判定に戻してから）
