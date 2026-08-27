-- ═══════════════════════════════════════════════════════════════════════════
-- 人 → 標準スキル ow_user_skills を作る（2026-08-27）
--
-- ⚠️ **標準スキル（`ow_skills`）から選ぶだけ。自由入力の受け皿は作らない。**
--    何が足りないかは `ow_search_logs.unresolved` に出るので、
--    **実際に何が求められているかがログで見えてから**作る
--    （docs/phase0-skills-20260827.md の3層のうち②はまだ用意しない）。
--
-- ⚠️ **年数は持たない。** 自己申告の年数は更新されず古くなる。
--    社会人年数を `ow_profiles.experience_years` から `calcTotalExperience` の
--    都度計算へ移した 2026-08-07 と同じ理由（CLAUDE.md）。
--
-- ── ★RLS / GRANT は `ow_user_languages`（2026-08-24）に揃えた ──────────────
-- あちらは `ow_user_certifications` → `ow_user_awards` と写されてきた**この family の
-- 現行の形**で、スキルは学歴より「人に付く平らな属性」としてそちらに近い。
-- ⚠️ `ow_user_educations` も**まったく同じ形**（5ポリシー / anon は SELECT なし）
--    なので、どちらに揃えても結果は同じ。新しい側に合わせた。
--
--   ポリシー5本: select_own / select_admin / insert_own / update_own / delete_own
--   GRANT      : anon なし / authenticated はテーブルレベルで SELECT INSERT UPDATE DELETE
--
-- ⚠️ **anon に GRANT しない。** 公開プロフィール（`/u/[id]`）の読み取りは
--    `createAdminClient` を通っており、educations / certifications / languages /
--    awards もすべて同じ。ここだけ anon に開くと、PostgREST から
--    全員ぶんのスキルが引ける経路が増える。
--
-- ⚠️ `authenticated` から GRANT を剥がさないこと。運営も authenticated ロールで来る。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

create table public.ow_user_skills (
  /* ⚠️ 複合主キーにせず `id` を持たせる。family（educations / languages /
        certifications）が全部 `id` を持っており、`lib/supabase/mutate.ts` の
        ヘルパーが戻り列を要求するため（CLAUDE.md「`id` 列が無い表がある」）。 */
  id uuid primary key default gen_random_uuid(),

  user_id  uuid not null references public.ow_users(id)  on delete cascade,
  skill_id uuid not null references public.ow_skills(id) on delete cascade,

  created_at timestamptz not null default now(),

  /* 同じスキルを2回持たせない */
  unique (user_id, skill_id)
);

comment on table public.ow_user_skills is
  '人が持つ標準スキル。ow_skills から選ぶだけで自由入力は無い。年数は持たない（自己申告は古くなるため）。';

create index ow_user_skills_user_id_idx  on public.ow_user_skills (user_id);
create index ow_user_skills_skill_id_idx on public.ow_user_skills (skill_id);

alter table public.ow_user_skills enable row level security;

-- ★anon には配らない（公開プロフィールの読み取りは createAdminClient を通る）
grant select, insert, update, delete on public.ow_user_skills to authenticated;

-- 本人だけが自分の行を読み書きできる。運営は読める。
-- ⚠️ `user_id` は **ow_users.id 空間**。`auth.uid()` は auth.users.id なので
--    直接比べず、必ず ow_users を join して auth_id で引く（CLAUDE.md）。
create policy "ow_user_skills_select_own" on public.ow_user_skills for select
  using (user_id in (select u.id from public.ow_users u where u.auth_id = auth.uid()));

create policy "ow_user_skills_select_admin" on public.ow_user_skills for select
  using (auth_is_admin());

create policy "ow_user_skills_insert_own" on public.ow_user_skills for insert
  with check (user_id in (select u.id from public.ow_users u where u.auth_id = auth.uid()));

create policy "ow_user_skills_update_own" on public.ow_user_skills for update
  using (user_id in (select u.id from public.ow_users u where u.auth_id = auth.uid()));

create policy "ow_user_skills_delete_own" on public.ow_user_skills for delete
  using (user_id in (select u.id from public.ow_users u where u.auth_id = auth.uid()));

-- ── 検証。★「エラーが出なかった」を成功にしない ────────────────────────────
DO $$
DECLARE
  v_pol   int;
  v_anon  boolean;
  v_auth  boolean;
  v_langs int;
BEGIN
  SELECT count(*) INTO v_pol FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname = 'ow_user_skills';
  -- ★同じ family（ow_user_languages）と同じ本数であること
  SELECT count(*) INTO v_langs FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname = 'ow_user_languages';
  IF v_pol <> v_langs THEN
    RAISE EXCEPTION 'ポリシーが % 本（ow_user_languages と同じ % 本のはず）。中止', v_pol, v_langs;
  END IF;

  v_anon := has_table_privilege('anon', 'public.ow_user_skills', 'SELECT');
  IF v_anon THEN RAISE EXCEPTION 'anon が SELECT できてしまう。中止'; END IF;

  v_auth := has_table_privilege('authenticated', 'public.ow_user_skills', 'INSERT');
  IF NOT v_auth THEN RAISE EXCEPTION 'authenticated が INSERT できない。運営も書けなくなる。中止'; END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'ow_user_skills') THEN
    RAISE EXCEPTION 'RLS が有効になっていない。中止';
  END IF;

  RAISE NOTICE '完了: ポリシー % 本 / anon SELECT なし / authenticated INSERT あり', v_pol;
END $$;

COMMIT;
