-- 資格（ow_user_certifications）を作る（2026-08-24）
--
-- LinkedIn の「資格」に合わせた5項目。柴さんの指示で項目を確定した。
--   名称 / 発行団体 / 発行日 / 認定番号 / 認証URL
--
-- ⚠️ **既存の `ow_user_awards`（受賞・表彰）と同じ形に揃えてある。**
--    RLS・GRANT・索引の張り方まで写しているので、片方を直すときはもう片方も見ること。
--    実測で写した（2026-08-24）: authenticated は SELECT/INSERT/UPDATE/DELETE の
--    **テーブルレベル**、anon は**権限なし**、RLS は本人行のみ＋運営の SELECT。
--
-- ⚠️ **anon に GRANT しない。** 公開プロフィール（`/u/[id]`）の読み取りは
--    `createAdminClient` を通っており、awards / achievements / educations も同じ。
--    ここだけ anon に開くと、PostgREST から全員ぶんの資格が引ける経路が増える。
--
-- ⚠️ 列単位 GRANT のテーブルではない（CLAUDE.md の一覧に入れない）。
--    後から列を足す場合はテーブルレベルのままで読める。
--
-- ⚠️ **`experience_id` は持たない。** awards は「どの職歴での受賞か」を持つが、
--    資格は職歴に紐づかない（LinkedIn も紐づけていない）。必要になってから足す。

create table public.ow_user_certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ow_users(id) on delete cascade,

  -- 名称（必須）。例: 「IT コーディネータ」
  name text not null,

  -- 発行団体。例: 「経済産業省」
  issuer text,

  -- 発行日。⚠️ **画面には年月までしか出さない**（LinkedIn と同じ「2025年1月」）。
  --   日まで持つのは date 型がそれしか無いため。
  --   ⚠️ API は `YYYY-MM` を受け取って **`YYYY-MM-01` に正規化してから**入れる。
  --      Postgres は `'2025-01'::date` を **22007 で拒否する**（実測 2026-08-24）。
  --      ⚠️ `ow_user_awards` の API は `YYYY-MM` をそのまま渡しており、
  --         年月だけで保存すると 500 になる。あちらは別途直す（docs/todo.md）。
  issued_at date,

  -- 認定番号。例: 「9041982022C」
  credential_id text,

  -- 認証URL（発行元の確認ページ）。⚠️ http/https だけを受ける検証は API 側。
  credential_url text,

  sort_order integer not null,
  created_at timestamptz not null default now()
);

comment on table public.ow_user_certifications is
  '資格。LinkedIn の「資格」に相当する5項目。ow_user_awards と同じ権限構成';
comment on column public.ow_user_certifications.issued_at is
  '発行日。画面には年月までしか出さない。API が YYYY-MM を YYYY-MM-01 に正規化して入れる';

-- ── 索引 ───────────────────────────────────────────────────────────────────
-- ⚠️ **user_id の1本だけ。** 2026-08-23 に冗長な索引18本を落としたばかりで、
--    このDBはユーザーテーブル10MBに対し索引6MB・411本と既に過剰。
--    主キーの索引は制約が自動で作るので書かない。
create index ow_user_certifications_user_id_idx
  on public.ow_user_certifications (user_id);

-- ── GRANT ──────────────────────────────────────────────────────────────────
-- ⚠️ **新しいテーブルには既定で権限が付かない。** 書き忘れると authenticated から
--    一切触れず、しかも「0件」として静かに素通りする（CLAUDE.md）。
grant select, insert, update, delete on public.ow_user_certifications to authenticated;
-- ⚠️ anon には配らない（上の理由）。service_role は既定で持つ。

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.ow_user_certifications enable row level security;

-- 本人の行だけ。⚠️ `auth.uid()` は auth.users.id、`user_id` は ow_users.id で
--    **空間が違う**ので、必ず ow_users を経由して突き合わせる（CLAUDE.md）。
create policy ow_user_certifications_select_own
  on public.ow_user_certifications for select
  using (user_id in (select u.id from public.ow_users u where u.auth_id = auth.uid()));

create policy ow_user_certifications_insert_own
  on public.ow_user_certifications for insert
  with check (user_id in (select u.id from public.ow_users u where u.auth_id = auth.uid()));

create policy ow_user_certifications_update_own
  on public.ow_user_certifications for update
  using (user_id in (select u.id from public.ow_users u where u.auth_id = auth.uid()));

create policy ow_user_certifications_delete_own
  on public.ow_user_certifications for delete
  using (user_id in (select u.id from public.ow_users u where u.auth_id = auth.uid()));

-- 運営。⚠️ admin も `authenticated` ロールで来るので、GRANT を剥がすと
--    RLS まで到達しない（2026-08-16 に ow_settings で踏んでいる）。
create policy ow_user_certifications_select_admin
  on public.ow_user_certifications for select
  using (public.auth_is_admin());

-- ── 適用後の実測（catalog を見るだけでは足りないので、後で PostgREST も叩く）──
do $$
begin
  if not has_table_privilege('authenticated', 'public.ow_user_certifications', 'SELECT') then
    raise exception 'authenticated に SELECT が無い';
  end if;
  if not has_table_privilege('authenticated', 'public.ow_user_certifications', 'INSERT') then
    raise exception 'authenticated に INSERT が無い';
  end if;
  if has_table_privilege('anon', 'public.ow_user_certifications', 'SELECT') then
    raise exception 'anon に SELECT が付いている（配らない方針）';
  end if;
end $$;
