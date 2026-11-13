-- ════════════════════════════════════════════════════════════════════════
-- Next Manager（2026-11-13 / 柴さんの指示）
--   「現場のマネージャーが自分で採用する」ための記録。
-- ════════════════════════════════════════════════════════════════════════
--
-- 決めたこと（フェーズ0の論点 A〜C。2026-11-13 に柴さんが推奨案で了承）:
--   A. 「採用中」にできるのは、その会社の **有効な担当者（ow_company_admins.is_active）** だけ。
--      職歴の現職（自己申告）では採用中にできない（誰でも他社の候補者管理に記録を作れてしまうため）。
--      オンにできるのは本人だけ（API が本人の行かを確かめる）。
--   B. 2026-11-03〜05 に外した「立場＝採用担当」（ow_talk_settings）とは別物として作る。あの表は使わない。
--   C. マッチング＝採用中のマネージャーとの個人どうしのメッセージで、**相手が返信した**時点
--      （reply_to_message_request の成功直後。TS の lib/nextManager/server.ts）。
--      相互フォローで最初から始まる会話（返信を経ない）は数えない。採用中かどうかは返信の時点で見る。
--
-- ⚠️★メッセージ本文は記録に一切写さない。ow_manager_matches に本文の列を作らない。
-- ⚠️★DM の会話（ow_conversations）に company_id を入れない。入れた瞬間に RLS（ow_conversations_select の
--    auth_company_can(company_id, 'work')）が会社の担当者に会話を開く。記録はこの別表に持つ。
-- ⚠️ 記録の所有は会社。マネージャーが会社から外れても（is_active=false）記録は消さない。
--    マネージャーのアカウントが消えたときも記録は残す（manager_user_id を null にする）。
-- ⚠️ 2つの新しい表は anon / authenticated に権限なし・ポリシー0本。読み書きは API（service role）だけ。
-- ⚠️★ow_company_admins は authenticated にテーブル全体の読み書き（arwd）、anon に SELECT が配られている
--    （2026-11-13 に relacl で実測。フェーズ0で「権限0」と報告したのは誤りだった ——information_schema で数えたため見えていなかった）。
--    RLS は「同じ会社のメンバーは読める」「会社の管理者（admin）は同じ会社の行を書き換えられる」。
--    → 足す列は同じ会社のメンバーに読める（採用中かどうかは社内に見えてよい）。
--    → ★書き換えは、会社の管理者でも他人の「採用中」を変えられてしまうので、トリガーで止める（下の 1-b）。
--      変えてよいのはサーバー（service_role）だけで、サーバーは本人の行かを確かめてから書く（lib/nextManager/server.ts）。
--
-- 作業前ダンプ: .dumps/20261113-0046-ow_company_admins.sql（25行）
--
-- 戻し方:
--   drop trigger trg_guard_company_admin_hiring on public.ow_company_admins;
--   drop function public.guard_company_admin_hiring();
--   drop table public.ow_manager_match_handovers; drop table public.ow_manager_matches;
--   alter table public.ow_company_admins drop column hiring_updated_at, drop column hiring_job_id,
--     drop column hiring_note, drop column is_hiring;
-- ════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. 採用中のマネージャー ─────────────────────────────────────────────
alter table public.ow_company_admins
  add column is_hiring boolean not null default false,
  -- 「フィールドセールス・2名」のような短いテキスト。⚠️ 長さは lib/nextManager/constants.ts の HIRING_NOTE_MAX と同じ
  add column hiring_note text check (hiring_note is null or char_length(hiring_note) between 1 and 40),
  -- 既存の募集との紐付け（任意）。⚠️ 会社が同じかはアプリが確かめる（API）
  add column hiring_job_id uuid references public.ow_jobs(id) on delete set null,
  add column hiring_updated_at timestamptz;

-- ── 1-b. 採用中の列は、サーバー（service_role）以外から変えさせない ──────────────
--   ⚠️ 判定は auth.role()。current_user では見ない（SECURITY DEFINER の中では所有者に化けるため。CLAUDE.md）。
--   ⚠️ migration（postgres）からの変更は通す（auth.role() が null になる経路。運営が直すときのため）。
--   ⚠️ SECURITY INVOKER のまま（DEFINER にしない）。
create or replace function public.guard_company_admin_hiring()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.is_hiring or new.hiring_note is not null or new.hiring_job_id is not null or new.hiring_updated_at is not null then
        raise exception '採用中の設定は本人が設定画面から変えてください' using errcode = '42501';
      end if;
    elsif new.is_hiring is distinct from old.is_hiring
       or new.hiring_note is distinct from old.hiring_note
       or new.hiring_job_id is distinct from old.hiring_job_id
       or new.hiring_updated_at is distinct from old.hiring_updated_at then
      raise exception '採用中の設定は本人が設定画面から変えてください' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;
revoke execute on function public.guard_company_admin_hiring() from public, anon, authenticated;

create trigger trg_guard_company_admin_hiring
  before insert or update on public.ow_company_admins
  for each row execute function public.guard_company_admin_hiring();

comment on column public.ow_company_admins.is_hiring is
  'Next Manager の「採用中」（2026-11-13）。本人だけがオンにできる（API が本人の行かを確かめる）。is_active でない行では意味を持たない。';

-- ── 2. マッチングの記録（会社のもの） ────────────────────────────────────
create table public.ow_manager_matches (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.ow_companies(id) on delete cascade,
  -- いまの担当マネージャー。引き継ぎで付け替わる。⚠️ アカウントが消えても記録は残す
  manager_user_id   uuid references public.ow_users(id) on delete set null,
  candidate_user_id uuid not null references public.ow_users(id) on delete cascade,
  -- マネージャーが自分の欄を引くためだけに使う。⚠️ 会社の画面には出さない（本文に辿らせない）
  conversation_id   uuid references public.ow_conversations(id) on delete set null,
  matched_at        timestamptz not null default now(),
  job_id            uuid references public.ow_jobs(id) on delete set null,
  met_on            date,
  -- null ＝「面談前」。⚠️ 値は lib/nextManager/constants.ts の MATCH_RESULTS と同じ
  result            text check (result in ('next_step', 'continue', 'declined', 'hired')),
  memo              text check (memo is null or char_length(memo) <= 1000),
  created_by        uuid references public.ow_users(id) on delete set null,
  updated_by        uuid references public.ow_users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint ow_manager_matches_not_self check (manager_user_id is null or manager_user_id <> candidate_user_id),
  -- 1つの会話について、1つの会社に記録は1件
  constraint ow_manager_matches_company_conversation unique (company_id, conversation_id)
);
create index ow_manager_matches_company_idx on public.ow_manager_matches(company_id, matched_at desc);
create index ow_manager_matches_manager_idx on public.ow_manager_matches(manager_user_id);
comment on table public.ow_manager_matches is
  'Next Manager のマッチングの記録（2026-11-13）。会社のもの。メッセージ本文は持たない。読み書きは API（service role）だけ。anon / authenticated に GRANT しない・ポリシーを書かない。';

-- ── 3. 引き継ぎの履歴 ───────────────────────────────────────────────────
create table public.ow_manager_match_handovers (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references public.ow_manager_matches(id) on delete cascade,
  from_user_id    uuid references public.ow_users(id) on delete set null,
  to_user_id      uuid references public.ow_users(id) on delete set null,
  handed_over_by  uuid references public.ow_users(id) on delete set null,
  handed_over_at  timestamptz not null default now()
);
create index ow_manager_match_handovers_match_idx on public.ow_manager_match_handovers(match_id, handed_over_at desc);
comment on table public.ow_manager_match_handovers is
  'Next Manager の記録の引き継ぎ（2026-11-13）。読み書きは API（service role）だけ。';

-- ── 4. 権限: クライアントのロールには何も配らない ─────────────────────────
alter table public.ow_manager_matches enable row level security;
alter table public.ow_manager_match_handovers enable row level security;
revoke all on table public.ow_manager_matches from public, anon, authenticated;
revoke all on table public.ow_manager_match_handovers from public, anon, authenticated;
grant select, insert, update, delete on table public.ow_manager_matches to service_role;
grant select, insert, update, delete on table public.ow_manager_match_handovers to service_role;

-- ── 5. 適用の中で確かめる ───────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['public.ow_manager_matches', 'public.ow_manager_match_handovers'] loop
    if has_table_privilege('anon', t, 'SELECT')
       or has_table_privilege('authenticated', t, 'SELECT')
       or has_table_privilege('authenticated', t, 'INSERT')
       or has_table_privilege('authenticated', t, 'UPDATE')
       or has_table_privilege('authenticated', t, 'DELETE') then
      raise exception '% にクライアントのロールの権限が残っている', t;
    end if;
    if (select count(*) from pg_policy where polrelid = t::regclass) <> 0 then
      raise exception '% にポリシーがある（0本のはず）', t;
    end if;
  end loop;
  -- 採用中の列の書き換えを止めるトリガーが付いていること（authenticated にはテーブルの UPDATE があるため）
  if not exists (select 1 from pg_trigger where tgrelid = 'public.ow_company_admins'::regclass
                  and tgname = 'trg_guard_company_admin_hiring' and not tgisinternal) then
    raise exception 'trg_guard_company_admin_hiring が無い';
  end if;
  -- 既存の行は全部「採用中でない」で始まる
  if exists (select 1 from public.ow_company_admins where is_hiring) then
    raise exception 'is_hiring が立っている行がある（既定は false のはず）';
  end if;
end $$;

commit;
