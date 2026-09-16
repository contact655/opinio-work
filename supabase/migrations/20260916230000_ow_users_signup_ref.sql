-- 登録経路の計測（`?ref=`）: ow_users.signup_ref を足す（2026-09-16）
--
-- ── 何のためか ──────────────────────────────────────────────────────────────
-- 特定の企業の在籍者・元在籍者に個別に声をかけて登録を依頼する。
-- どの声かけから何人が登録し、経歴まで入れたかを測れるようにする。
-- 設計は docs/signup-ref-design-20260916.md。
--
-- ⚠️★**語彙を CHECK で固定しない。** 声かけのたびに ref が増えるので、
--    列挙にすると毎回 migration が要る。縛るのは**値の集合ではなく形式**。
--    ＝ CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」は
--       ここには当てはまらない（`ow_companies.source` とは性質が違う）。
--
-- ⚠️★**GRANT を付けない（意図）。** `ow_users` は SELECT も UPDATE も列単位 GRANT
--    なので、新しい列は**何の権限も持たないまま生まれる**。それが狙い:
--      ・読むのは `/admin/signup-refs` だけ（`createAdminClient` ＝ service_role）
--      ・書くのは `POST /api/jobseeker/signup-ref` だけ（同じく service_role）
--    `can_casual_meeting` / `is_test` / `email` と同じ扱い。
--    ⚠️ したがって**セッションのクライアントで select に混ぜないこと。**
--       混ぜるとクエリごと 403 になり、`?? []` で受けている側では静かに0件になる。
--
-- ⚠️★**既存行は NULL のままにする。** `created_at` から推測して埋めない
--    （CLAUDE.md「値が無いことを、ある値に置き換えない」）。
--    NULL は「直接・不明」であって「効果が無かった」ではない。
--
-- ⚠️ 作業前ダンプ: .dumps/20260916-2343-ow_users.sql（48行 / スキーマ+データ）

begin;

-- ── 事前チェック ────────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ow_users' and column_name = 'signup_ref'
  ) then
    raise exception 'ow_users.signup_ref は既に存在する。中止する';
  end if;
end $$;

alter table public.ow_users add column signup_ref text;

comment on column public.ow_users.signup_ref is
  '登録経路（?ref=）。登録後に1回だけ書き、以後は上書きしない。'
  '⚠️ 個人を特定できる文字列を入れない運用。形式のみ CHECK で担保する。'
  '⚠️ 列単位 GRANT を意図的に配っていない（運営＝service_role だけが読み書きする）。'
  '詳細: docs/signup-ref-design-20260916.md';

-- 形式だけ縛る。⚠️ `src/lib/constants/signupRef.ts` の SIGNUP_REF_PATTERN と**同じ式**。
--    片方を変えたら必ずもう片方も変えること（SQL と TS なので共有できない）。
alter table public.ow_users
  add constraint ow_users_signup_ref_format
  check (signup_ref is null or signup_ref ~ '^[a-z0-9][a-z0-9_-]{0,39}$');

-- 集計は ref ごとの group by。NULL が大多数になるので部分インデックスにする。
create index if not exists ow_users_signup_ref_idx
  on public.ow_users (signup_ref) where signup_ref is not null;

-- ── 事後チェック ────────────────────────────────────────────────────────────
do $$
declare
  v_rows int;
  v_granted_auth boolean;
  v_granted_anon boolean;
begin
  select count(*) into v_rows from public.ow_users where signup_ref is not null;
  if v_rows <> 0 then
    raise exception '追加直後に signup_ref が入っている行がある（% 行）。中止する', v_rows;
  end if;

  -- ★GRANT を配っていないことを明示的に確かめる（配ってしまうと運営専用でなくなる）
  v_granted_auth := has_column_privilege('authenticated', 'public.ow_users', 'signup_ref', 'SELECT');
  v_granted_anon := has_column_privilege('anon',          'public.ow_users', 'signup_ref', 'SELECT');
  if v_granted_auth or v_granted_anon then
    raise exception 'signup_ref に SELECT が配られている（authenticated=% / anon=%）。意図と違う',
      v_granted_auth, v_granted_anon;
  end if;

  raise notice 'ow_users.signup_ref を追加した（GRANT なし・既存行は NULL）';
end $$;

commit;
