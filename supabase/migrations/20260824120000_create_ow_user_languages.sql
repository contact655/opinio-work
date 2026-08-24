-- 言語（ow_user_languages）を作る（2026-08-24）
--
-- LinkedIn の「言語」に合わせた2項目。柴さんの指示で**資格の下**に出す。
--   言語名 / 習熟度
--
-- ⚠️ **話せる言語**であって、プログラミング言語ではない（`lib/techStack.ts` の
--    「言語」とは無関係）。同じ語なので、参照を混ぜないこと。
--
-- ⚠️ **`ow_user_certifications`（2026-08-24）と同じ形に揃えてある。**
--    RLS・GRANT・索引の張り方まで写している。片方を直すときはもう片方も見ること。
--    - authenticated はテーブルレベルで SELECT/INSERT/UPDATE/DELETE
--    - anon には配らない（公開プロフィールの読み取りは createAdminClient を通る）
--    - RLS は本人行のみ ＋ 運営の SELECT
--    - 索引は user_id の1本だけ
--
-- ⚠️ 列単位 GRANT のテーブルではない（CLAUDE.md の一覧に入れない）。
--
-- ⚠️ **`experience_id` は持たない。** 言語は職歴に紐づかない（資格と同じ）。

create table public.ow_user_languages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ow_users(id) on delete cascade,

  -- 言語名（必須）。例: 「英語」。⚠️ 自由入力。マスタは持たない
  --    （LinkedIn も自由入力。方言・手話・少数言語を運営が数えられないため）。
  name text not null,

  -- 習熟度（任意）。⚠️ **値は `src/lib/constants/languageProficiency.ts` と揃えること。**
  --    UI / API / DB の CHECK の3つを揃える（CLAUDE.md）。1つでも欠けると
  --    「選べるのに保存できない」か「保存できるのに絞れない」のどちらかになる。
  --    ⚠️ 任意項目なので **null を許す**。「初級」で埋めない
  --       （値が無いことを、ある値に置き換えない）。
  proficiency text
    check (proficiency in ('native', 'full', 'professional', 'limited', 'elementary')),

  sort_order integer not null,
  created_at timestamptz not null default now()
);

comment on table public.ow_user_languages is
  '言語（話せる言語）。LinkedIn の「言語」に相当。ow_user_certifications と同じ権限構成';
comment on column public.ow_user_languages.proficiency is
  '習熟度。値は src/lib/constants/languageProficiency.ts と同じ5値。null は未選択';

-- ── 索引 ───────────────────────────────────────────────────────────────────
-- ⚠️ **user_id の1本だけ。** このDBはユーザーテーブル10MBに対し索引6MB・411本と
--    既に過剰（2026-08-23 に冗長索引18本を落としたばかり）。
create index ow_user_languages_user_id_idx
  on public.ow_user_languages (user_id);

-- ── GRANT ──────────────────────────────────────────────────────────────────
-- ⚠️ **新しいテーブルには既定で権限が付かない。** 書き忘れると authenticated から
--    一切触れず、しかも「0件」として静かに素通りする（CLAUDE.md）。
grant select, insert, update, delete on public.ow_user_languages to authenticated;
-- ⚠️ anon には配らない。service_role は既定で持つ。

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.ow_user_languages enable row level security;

-- 本人の行だけ。⚠️ `auth.uid()` は auth.users.id、`user_id` は ow_users.id で
--    **空間が違う**ので、必ず ow_users を経由して突き合わせる（CLAUDE.md）。
create policy ow_user_languages_select_own
  on public.ow_user_languages for select
  using (user_id in (select u.id from public.ow_users u where u.auth_id = auth.uid()));

create policy ow_user_languages_insert_own
  on public.ow_user_languages for insert
  with check (user_id in (select u.id from public.ow_users u where u.auth_id = auth.uid()));

create policy ow_user_languages_update_own
  on public.ow_user_languages for update
  using (user_id in (select u.id from public.ow_users u where u.auth_id = auth.uid()));

create policy ow_user_languages_delete_own
  on public.ow_user_languages for delete
  using (user_id in (select u.id from public.ow_users u where u.auth_id = auth.uid()));

-- 運営。⚠️ admin も `authenticated` ロールで来るので、GRANT を剥がすと
--    RLS まで到達しない（2026-08-16 に ow_settings で踏んでいる）。
create policy ow_user_languages_select_admin
  on public.ow_user_languages for select
  using (public.auth_is_admin());

-- ── 適用後の実測（catalog を見るだけでは足りないので、後で PostgREST も叩く）──
do $$
begin
  if not has_table_privilege('authenticated', 'public.ow_user_languages', 'SELECT') then
    raise exception 'authenticated に SELECT が無い';
  end if;
  if not has_table_privilege('authenticated', 'public.ow_user_languages', 'INSERT') then
    raise exception 'authenticated に INSERT が無い';
  end if;
  if has_table_privilege('anon', 'public.ow_user_languages', 'SELECT') then
    raise exception 'anon に SELECT が付いている（配らない方針）';
  end if;
end $$;
