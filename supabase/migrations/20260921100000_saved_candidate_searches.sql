-- ═══════════════════════════════════════════════════════════════════════════
-- 候補者検索の「条件を保存する」受け皿（2026-09-21）
--
-- ⚠️ **追加のみ。** 既存の表・列・ポリシー・GRANT には一切触れない。
--
-- ── ★なぜ localStorage ではなく表にしたか ─────────────────────────────────
-- 採用の作業なので、**端末を変えても残る**必要がある。
-- ⚠️ `/people` の表示形式（grid / list）を localStorage に置いているのは
--    **その人の好み**で、消えても困らないから。**性質が違う。**
--
-- ── ★なぜ「人ごと」で、企業内で共有しないか ───────────────────────────────
-- 保存した条件は**試行錯誤の途中**を含む。チームで共有すると、
-- 「これは誰の、いつの条件か」を持たない限り、消していいのか分からない行が溜まる。
-- ⚠️ 共有が要るなら **`shared boolean` を足す**（RLS を1本足すだけで済む形にしてある）。
--    最初から共有にすると、後から「人ごと」へは戻せない。
--
-- ── ★同じ人が複数社を担当しうるので `(company_id, owner_user_id)` の2本立て ──
-- 会社を切り替えたときに別会社の条件が出ると、**送る相手を間違える**。
--
-- ── ★RLS / GRANT の形は `ow_proposals`（20260918180000）に揃えた ────────────
--   ・`authenticated` は **SELECT のみ**。書き込みは API（service_role）だけ
--   ・`anon` には配らない
--   ・`FOR ALL` を使わない
-- ⚠️★**運営（admin）の SELECT ポリシーは意図的に置いていない。**
--    他人の検索条件を運営が見る業務が無いため。必要になったら足す。
--
-- ⚠️★**インデックスを足していない。** UNIQUE 制約が
--    `(company_id, owner_user_id, name)` の索引を作り、一覧の絞り込みは
--    その先頭2列で足りる。CLAUDE.md「FK にインデックスを足さない（このDBは
--    実データ 10MB に対し索引 6MB で既に過剰）」。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

create table public.ow_saved_candidate_searches (
  id uuid primary key default gen_random_uuid(),

  /* ⚠️★**ow_users.id 空間**（`auth.uid()` ではない）。列名で示している。
        CLAUDE.md「引数名でどちらの空間かを示す」と同じ趣旨。 */
  owner_user_id uuid not null references public.ow_users(id)     on delete cascade,
  company_id    uuid not null references public.ow_companies(id) on delete cascade,

  /* 一覧に出す名前。⚠️ 空白だけの名前を作らせない */
  name text not null,

  /* ★絞り込みの中身。**画面の state をそのまま入れる**（`SavedCandidateFilters`）。
     ⚠️★**列に割らないこと。** 条件は 16 個あり、増減する。列にすると
        条件を1つ足すたびに migration が要り、**足し忘れた条件が静かに
        保存されない**形になる（CLAUDE.md「経歴に列を足すときは4箇所を揃える」と同じ罠）。
     ⚠️ 代わりに、**読むときに知らないキーを捨て、欠けたキーを既定値で埋める**
        （`lib/business/savedSearch.ts` の `parseSavedFilters`）。
        条件を減らした日に、古い行を読んで壊れないようにするため。 */
  filters jsonb not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* ⚠️ 同じ名前を2つ作らせない。**「同じ名前で保存＝上書き」の鍵**にもなる */
  constraint saved_search_name_unique unique (company_id, owner_user_id, name),
  /* ⚠️ 空白だけを弾く。UI 側でも trim するが、**API を直接叩かれても入らない**ように */
  constraint saved_search_name_not_blank check (btrim(name) <> ''),
  constraint saved_search_name_len       check (char_length(name) <= 60),
  /* ⚠️ jsonb はスカラも入るので、オブジェクトであることを縛る */
  constraint saved_search_filters_object check (jsonb_typeof(filters) = 'object')
);

comment on table public.ow_saved_candidate_searches is
  '候補者検索（/biz/candidates）の保存した条件。人ごと・企業ごと。⚠ filters は画面の state をそのまま入れる jsonb（列に割らない。条件が増減するため）。⚠ 書き込みは API（service_role）のみ。';
comment on column public.ow_saved_candidate_searches.owner_user_id is
  '⚠ ow_users.id 空間（auth.uid() ではない）';
comment on column public.ow_saved_candidate_searches.filters is
  '⚠ 読むときに知らないキーを捨て、欠けたキーは既定値で埋める（lib/business/savedSearch.ts）。古い行を読んで壊れないようにするため。';

alter table public.ow_saved_candidate_searches enable row level security;

/* ★anon には配らない。authenticated は **SELECT のみ**。
   ⚠️ authenticated から剥がさないこと。運営も authenticated ロールで来る。 */
grant select on public.ow_saved_candidate_searches to authenticated;

/* 本人が自分の行だけ読める。
   ⚠️★企業の管理者どうしでも見えない（冒頭の「人ごと」の理由）。 */
create policy "ow_saved_candidate_searches_select_own"
  on public.ow_saved_candidate_searches for select
  using (owner_user_id = public.auth_ow_user_id());

-- ── ★検証。「エラーが出なかった」を成功にしない ────────────────────────────
DO $$
DECLARE
  v_pol int; v_user uuid; v_company uuid; v_id uuid; v_ok boolean;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'ow_saved_candidate_searches') THEN
    RAISE EXCEPTION 'RLS が無効。中止'; END IF;

  SELECT count(*) INTO v_pol FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname = 'ow_saved_candidate_searches';
  IF v_pol <> 1 THEN RAISE EXCEPTION 'ポリシーが % 本（1本のはず）。中止', v_pol; END IF;

  IF EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
              WHERE c.relname = 'ow_saved_candidate_searches' AND p.polcmd = '*') THEN
    RAISE EXCEPTION 'FOR ALL のポリシーがある。操作ごとに分けること。中止'; END IF;

  IF has_table_privilege('anon', 'public.ow_saved_candidate_searches', 'SELECT') THEN
    RAISE EXCEPTION 'anon が SELECT できてしまう。中止'; END IF;
  IF NOT has_table_privilege('authenticated', 'public.ow_saved_candidate_searches', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated が SELECT できない。運営も読めなくなる。中止'; END IF;
  IF has_table_privilege('authenticated', 'public.ow_saved_candidate_searches', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated に INSERT が付いている。書き込みは API だけ。中止'; END IF;

  -- ★CHECK と UNIQUE が本当に効くかを実データで試す（入れて→落ちるのを確かめて→消す）
  SELECT id INTO v_user    FROM public.ow_users     LIMIT 1;
  SELECT id INTO v_company FROM public.ow_companies LIMIT 1;
  IF v_user IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'ow_users / ow_companies が空。検証できない。中止'; END IF;

  INSERT INTO public.ow_saved_candidate_searches (owner_user_id, company_id, name, filters)
  VALUES (v_user, v_company, '__migration_check__', '{}'::jsonb) RETURNING id INTO v_id;

  -- 同じ名前は2つ入らない
  v_ok := false;
  BEGIN
    INSERT INTO public.ow_saved_candidate_searches (owner_user_id, company_id, name, filters)
    VALUES (v_user, v_company, '__migration_check__', '{}'::jsonb);
  EXCEPTION WHEN unique_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '同じ名前が2つ入ってしまう。中止'; END IF;

  -- 空白だけの名前は入らない
  v_ok := false;
  BEGIN
    INSERT INTO public.ow_saved_candidate_searches (owner_user_id, company_id, name, filters)
    VALUES (v_user, v_company, '   ', '{}'::jsonb);
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '空白だけの名前が入ってしまう。中止'; END IF;

  -- filters がオブジェクトでなければ入らない
  v_ok := false;
  BEGIN
    INSERT INTO public.ow_saved_candidate_searches (owner_user_id, company_id, name, filters)
    VALUES (v_user, v_company, '__migration_check2__', '"x"'::jsonb);
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'filters にスカラが入ってしまう。中止'; END IF;

  DELETE FROM public.ow_saved_candidate_searches WHERE id = v_id;
  IF EXISTS (SELECT 1 FROM public.ow_saved_candidate_searches) THEN
    RAISE EXCEPTION '検証行が残っている。中止'; END IF;

  RAISE NOTICE '✅ ow_saved_candidate_searches: RLS 1本 / anon なし / authenticated は SELECT のみ / UNIQUE と CHECK が効く';
END $$;

COMMIT;
