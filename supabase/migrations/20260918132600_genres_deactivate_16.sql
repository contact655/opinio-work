-- ジャンルを5つに絞る（2026-09-18 / 柴さんの確定）
--
-- ── 何をするか ────────────────────────────────────────────────────────────
-- `ow_genres` 21件のうち **16件を `is_active = false`** にする。
-- ★**行は消さない。明細（`ow_company_genres`）も消さない。** UPDATE 1本で戻せる。
--
-- ★残す5件（柴さんの確定）:
--   外資系 / ホリゾンタルSaaS / バーティカルSaaS / AI・LLM特化 / M&A・投資
--
-- ── なぜ外すか ────────────────────────────────────────────────────────────
-- ① **段階の語**（スタートアップ / 上場企業 / メガベンチャー / IPO準備中 /
--    シード〜シリーズA）… `ow_companies.phase` の担当。ジャンルと二重になる。
--    ⚠️ メガベンチャー・IPO準備中は `phase` 側に足す
--       （`20260918090000_phase_add_mega_venture_ipo_ready.sql`）。
-- ② **◯◯Tech 系**（FinTech・金融 / HealthTech / EdTech・学習 / HRTech・採用 /
--    LegalTech / MarTech / PropTech / EC・流通 / データ分析 / 業務DX）…
--    `ow_business_domains`（事業領域）と役割が重なる。
-- ③ **DX/コンサル** … 何をしている会社かを言えていない（柴さんの判断）。
--
-- ⚠️★**AI・LLM特化 と M&A・投資 は残す**（柴さんの判断）。②に見えるが、
--    事業領域のマスタに対応する値が無いので、外すと言い換えられない。
--
-- ── 既存の明細への影響 ────────────────────────────────────────────────────
-- 実測（2026-09-18 / 本番。`ow_company_genres` は全4行）:
--   AI・LLM特化   → 株式会社Opinio        （★残す side。影響なし）
--   外資系        → 株式会社データプール  （★残す side。影響なし）
--   IPO準備中     → 株式会社Third Box     （is_test）
--   シード〜シリーズA → 株式会社Third Box  （is_test）
-- ＝ **タグが画面から消えるのは `is_test` の1社だけ。実企業は1社も影響を受けない。**
--
-- ⚠️ 明細は残るので、`is_active = true` に戻した日にそのまま復活する。
--
-- ── 直近に `ow_genres` を触った migration ────────────────────────────────
-- 投入は `archive/045_seed_genres.sql` / `archive/122_add_industry_genres.sql` /
-- `archive/123_redesign_genres.sql` と `20260727000000_baseline.sql`。
-- ★**`is_active` を変更した migration は1本も無い**（grep で確認。実測でも全21件 true）。
-- したがって**何も打ち消していない。**

begin;

-- ① 事前チェック：21件・全部 true であること
do $$
declare v_total int; v_active int;
begin
  select count(*), count(*) filter (where is_active) into v_total, v_active from public.ow_genres;
  if v_total <> 21 then
    raise exception '中止: ow_genres が想定（21件）と違う（実際 %件）。差分を確認すること', v_total;
  end if;
  if v_active <> 21 then
    raise exception '中止: 既に無効化されている行がある（有効 %件）。適用済みか、別の変更が入っている', v_active;
  end if;
end $$;

-- ② 外す16件を slug で明示列挙する
--    ⚠️ CLAUDE.md「対象を id または name で明示列挙する」。
--       `NOT IN (残す5件)` と書くと、**あとで足したジャンルまで巻き込む。**
update public.ow_genres
   set is_active = false
 where slug in (
   -- ① 段階の語（phase の担当）
   'startup',          -- スタートアップ
   'public-company',   -- 上場企業
   'mega-venture',     -- メガベンチャー
   'ipo-ready',        -- IPO準備中
   'early-stage',      -- シード〜シリーズA
   -- ② 事業領域と重なるもの
   'fintech',          -- FinTech・金融
   'healthtech',       -- HealthTech
   'edtech',           -- EdTech・学習
   'hrtech',           -- HRTech・採用
   'legaltech',        -- LegalTech
   'martech',          -- MarTech
   'proptech',         -- PropTech
   'ec-distribution',  -- EC・流通
   'data-analytics',   -- データ分析
   'business-dx',      -- 業務DX
   -- ③ 何をしている会社かを言えていない
   'dx-consulting'     -- DX/コンサル
 );

-- ③ 事後チェック：有効が「確定した5件」ちょうどであること
do $$
declare v_active text[];
begin
  select array_agg(slug order by slug) into v_active
    from public.ow_genres where is_active;

  if v_active is distinct from array[
    'ai-llm', 'foreign-capital', 'horizontal-saas', 'ma-investment', 'vertical-saas'
  ] then
    raise exception '中止: 残った有効ジャンルが想定と違う（実際 %）', v_active;
  end if;

  raise notice 'OK: 有効なジャンルは5件（外資系 / ホリゾンタルSaaS / バーティカルSaaS / AI・LLM特化 / M&A・投資）';
end $$;

commit;

-- ── 戻し方（必要になったら）─────────────────────────────────────────────
-- update public.ow_genres set is_active = true where slug in ( … 上の16件 … );
