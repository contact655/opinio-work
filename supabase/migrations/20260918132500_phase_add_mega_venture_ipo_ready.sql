-- 事業ステージに「メガベンチャー」「IPO準備中」を足す（2026-09-18 / 柴さんの指示）
--
-- ── なぜ ──────────────────────────────────────────────────────────────────
-- ジャンル（`ow_genres`）に「メガベンチャー」「IPO準備中」「シード〜シリーズA」
-- 「スタートアップ」「上場企業」という**段階の語**が混ざっていた。段階は
-- `ow_companies.phase` の担当なので、ジャンル側から外し、こちらへ寄せる。
-- （ジャンルの無効化は別ファイル `20260918091000_genres_deactivate_16.sql`）
--
-- ── 3層のうちの DB 層 ─────────────────────────────────────────────────────
-- CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」。
--   UI/API … `src/lib/constants/phase.ts` の `PHASE_OPTIONS`（同じコミットで追加）
--   DB     … このファイル
--
-- ⚠️★**どちらも `startup` の子**（`parent: "startup"`）。未上場なので「上場企業」の
--    下ではない。親の無い値にすると `expandPhase("startup")` から漏れて、
--    **「スタートアップ」で絞ったときにこの2社が出てこない。**
--
-- ⚠️★**この CHECK を広げずに UI だけ足すと、企業が選んだ瞬間に `ow_companies` の
--    UPDATE が丸ごと失敗する**（`phase` は列単位 GRANT で、1列でも弾かれると
--    PATCH 全体が落ちる）。2026-09-06 に同じ形の事故がある
--    （`/biz/company` の事業ステージが、どれを選んでも保存できなかった）。
--
-- ── 直近に同じ制約を触った migration ──────────────────────────────────────
-- `20260906120000_phase_two_level.sql`（8値 → 13値。親3＋子10へ2階層化）を確認した。
-- **打ち消していない。** 13値をそのまま残し、2値を足すだけ。
--
-- ── 既存データ ────────────────────────────────────────────────────────────
-- 実測（2026-09-18 / 本番）: listed 57 / NULL 18 / unicorn 11 / non_listed 7 /
-- startup 5 / listed_growth 3 / series_d 2 / series_b 1。
-- ★**1行も UPDATE しない。** 広げるだけなので既存行は全部通る。
--
-- ⚠️★**適用後に、実際に保存して確かめること**（この中では検証しない）。
--    CHECK の文字列を数えても「PATCH が通るか」は分からない
--    ——列単位 GRANT・RLS・アプリ側の検証が別にあるため。
--    手順: `is_test` の企業で `/biz/company` の事業ステージに
--          「メガベンチャー」を選んで保存 → DB の値を SELECT で確認 → 元に戻す。

begin;

-- ① 事前チェック：いまの CHECK が想定どおり13値であること
do $$
declare
  v_def text;
  v_old text[] := array[
    'startup','listed','non_listed','seed','series_a','series_b','series_c',
    'series_d','unicorn','listed_prime','listed_standard','listed_growth','listed_overseas'
  ];
  v text;
begin
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid = 'public.ow_companies'::regclass
     and conname  = 'ow_companies_phase_check';

  if v_def is null then
    raise exception '中止: ow_companies_phase_check が見つからない';
  end if;
  if v_def like '%mega_venture%' or v_def like '%ipo_ready%' then
    raise exception '中止: 既に適用済みらしい（def=%）', v_def;
  end if;
  foreach v in array v_old loop
    if v_def not like '%''' || v || '''%' then
      raise exception '中止: 想定外の CHECK（% が無い）。def=%', v, v_def;
    end if;
  end loop;
end $$;

-- ② 張り替え（13値 → 15値）
alter table public.ow_companies drop constraint ow_companies_phase_check;

alter table public.ow_companies add constraint ow_companies_phase_check
  check (
    phase is null or phase = any (array[
      -- 親
      'startup', 'listed', 'non_listed',
      -- startup の子
      'seed', 'series_a', 'series_b', 'series_c', 'series_d', 'unicorn',
      'mega_venture',      -- ★2026-09-18 追加（未上場で大規模化した企業）
      'ipo_ready',         -- ★2026-09-18 追加（上場申請・準備の段階）
      -- listed の子
      'listed_prime', 'listed_standard', 'listed_growth', 'listed_overseas'
    ])
  );

-- ③ 事後チェック：15値が揃っていること（1つでも落ちていたら中止）
do $$
declare
  v_def text;
  v_all text[] := array[
    'startup','listed','non_listed','seed','series_a','series_b','series_c',
    'series_d','unicorn','mega_venture','ipo_ready',
    'listed_prime','listed_standard','listed_growth','listed_overseas'
  ];
  v text;
begin
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid = 'public.ow_companies'::regclass
     and conname  = 'ow_companies_phase_check';

  foreach v in array v_all loop
    if v_def not like '%''' || v || '''%' then
      raise exception '中止: 張り替え後に % が無い。def=%', v, v_def;
    end if;
  end loop;

  -- CHECK が無効になっていないこと（NOT VALID で入っていないか）
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.ow_companies'::regclass
       and conname  = 'ow_companies_phase_check'
       and convalidated
  ) then
    raise exception '中止: CHECK が validated になっていない';
  end if;

  raise notice 'OK: ow_companies_phase_check は15値';
end $$;

commit;
