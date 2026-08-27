-- ============================================================================
-- 「転職について」の意思表示を、boolean から **未設定を持てる4値** に作り替える
--   2026-08-26 / フェーズ2
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- それまでの正は `ow_users.is_open_to_work`（boolean / NOT NULL / 既定 false）。
-- boolean には「まだ答えていない」が無い。実測（2026-08-26 / 本番）:
--     is_open_to_work = true  … 3件（実ユーザー3）
--     is_open_to_work = false … 35件（実ユーザー14 / テスト・システム21）
-- false 35件の中身は「false と答えた人」と「一度も触っていない人」が混ざっており、
-- **区別できない。**
--
-- ── 写像（★false は写さない）──────────────────────────────────────────────
--   true  → 'active'（積極的に検討中）… 対象を id で明示列挙する
--   false → **写さない。NULL（未設定）のままにする**
--
-- ⚠️ false を 'researching'（情報収集として）に倒さないこと。
--    「答えた false」と「触っていない false」を区別できない以上、
--    **どちらも「情報収集として答えた」ことにしてしまう。**
--    値が無いことを、ある値に置き換えない（CLAUDE.md「データ表示の原則」）。
--
-- ⚠️ `is_open_to_work` は **DROP しない**。読み手をコード側から外すだけ。
--    列とデータを残すのは、写さなかった 35件の事実を消さないため。
--
-- ⚠️ 4値は `src/lib/constants/careerPreferences.ts` の `CAREER_STANCES` と**同じ**。
--    値を足すときは CHECK と定数の両方を直すこと（UI / API / DB の3つを揃える）。
--
-- ⚠️ GRANT は書かない。`ow_profiles` は SELECT / UPDATE ともテーブルレベル
--    （実測 2026-08-26: authenticated SELECT 27/27・UPDATE 27/27 / anon SELECT 27/27）。
--    列単位で配っている `ow_users` / `ow_experiences` / `ow_career_profiles` /
--    `ow_company_members` / `ow_companies` とは違う。**適用後にアサートする。**
--
-- ⚠️ anon に SELECT があるのは RLS で塞がっている（anon 向けポリシーが1本も無い）。
--    この列だけ特別に隠す必要はない。
-- ============================================================================

alter table public.ow_profiles
  add column if not exists career_stance text;

comment on column public.ow_profiles.career_stance is
  '「転職について」の意思表示。null = まだ答えていない（既定値を付けないこと）。
   値は src/lib/constants/careerPreferences.ts の CAREER_STANCES と同じ4つ。
   2026-08-26 に ow_users.is_open_to_work（boolean）から移行した。
   ⚠️ is_open_to_work = false だった 35件は写していない（答えた false と
      触っていない false を区別できないため）。null のままが正。';

-- ⚠️ null は許す。「未設定」がこの列の要件そのもの。
alter table public.ow_profiles
  drop constraint if exists ow_profiles_career_stance_check;
alter table public.ow_profiles
  add constraint ow_profiles_career_stance_check
  check (career_stance is null
         or career_stance in ('active', 'open', 'researching', 'no_contact'));

-- ── 写像（true の3件のうち、ow_profiles の行があるのは2件）───────────────────
--
-- ⚠️★**3件のうち1件（生藤 弘樹 / ow_users.id 0c99e403-…）は移行できない。**
--    `ow_users.auth_id` が NULL（運営が作った行でログイン実体が無い）ため、
--    auth 空間を指す `ow_profiles.user_id` に紐づく行が作れない。
--    ⚠️ 画面上の実害は無い。`/biz/candidates` の母集合は
--       `ow_profiles.scout_enabled = true` で、この人は行が無いので**元から出ていない**。
--    ⚠️ 行を作って埋めない。auth.users に実体が無い user_id は FK に入らない。
--
-- ⚠️ 一括 UPDATE を書かない（CLAUDE.md）。対象は profile_id で明示列挙する。
update public.ow_profiles set career_stance = 'active'
 where id in (
   '4b2fdd86-9cec-4914-913f-1c4e401702dd',  -- 大塚悠貴
   'cefa9f15-52e9-493a-8cc2-766c5ec07f3e'   -- 福永陽貴
 );

-- ── 適用後のアサート ────────────────────────────────────────────────────────
do $$
declare
  n_active int;
  n_notnull int;
begin
  select count(*) into n_active  from public.ow_profiles where career_stance = 'active';
  select count(*) into n_notnull from public.ow_profiles where career_stance is not null;

  if n_active <> 2 or n_notnull <> 2 then
    raise exception '写像の件数が想定と違う: active=% / not null=%（期待は 2 / 2）', n_active, n_notnull;
  end if;

  -- ⚠️ GRANT は「一覧に無いこと」を根拠にせず、**適用後に測る**（CLAUDE.md）。
  if not has_column_privilege('authenticated', 'public.ow_profiles', 'career_stance', 'SELECT')
     or not has_column_privilege('authenticated', 'public.ow_profiles', 'career_stance', 'UPDATE') then
    raise exception 'career_stance に authenticated の SELECT / UPDATE が無い。grant が要る';
  end if;
end $$;
