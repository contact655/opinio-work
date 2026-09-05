-- ============================================================================
-- 業種マスタを2階層にする ——「製造業」の親を1つだけ作る
--
-- 作業前ダンプ: .dumps/20260905-1544-ow_industries-ow_companies-ow_company_target_industries.sql
-- 調査: docs/phase0-industry-hierarchy-20260905.md
-- ============================================================================
--
-- ── なぜ ──────────────────────────────────────────────────────────────────
-- 「製造業」という語が無く、電機・機械 / 素材・化学 / 食品・飲料 /
-- 電子機器・半導体 の4つに割れていた。これが2箇所で効いている:
--   ① 対象業界（軸2）: クアルコムジャパンが「顧客は複数の製造業にまたがる」ため
--      `target_industry_scope = NULL`（未確認）のまま止まっている
--   ② 求職者側: 企業登録ダイアログで、製造業の人が4つから選び分ける必要がある
--
-- ⚠️★**統合ではなく親子で解く**（2026-09-04 の判断）。統合すると粒度が落ち、
--    「半導体メーカー向け」と言いたい企業が言えなくなる。
--
-- ── ★親は「製造業」1つだけ ────────────────────────────────────────────────
-- 商社・卸売 / 小売・流通 に親（流通）は作らない。2026-09-05 に
-- 「意味が違うので統合しない」と判断したばかりで、親を作ると
-- 「流通向け」で両方に当たるようになり、その判断が半分戻る。
-- それ以外の値に親を作るのは**0社の器を増やすだけ**で、
-- 2026-08-25 に消した「105行の死蔵」を作り直すことになる。
--
-- ── ★既存企業の industry_id は付け替えない ────────────────────────────────
-- 親は**空の器**。子に紐づく企業（電子機器・半導体7社 / 食品・飲料1社）は
-- そのまま。付け替えの対象になる行は1件も無い。
-- ⚠️ ただし**それだけでは突合は繋がらない。** 本人側の祖先展開（コード側）が要る。
--
-- ── 採番 ──────────────────────────────────────────────────────────────────
-- `ow_roles` に倣い、**display_order は親ごとの相対順**にする
-- （実測: roles は親 1〜18／子は親ごとに 0〜26）。
-- ⚠️★**階層を持たない17値の相対順は変えない。** 「製造業」は
--    4値のうち最も上にあった「電子機器・半導体」の位置（旧2番）に置く。

BEGIN;

-- ── 0. 事前チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM public.ow_industries WHERE is_active;
  IF v_n <> 21 THEN RAISE EXCEPTION '有効な業種が21件でない（% 件）', v_n; END IF;

  -- ★slug がグローバル UNIQUE なので、先に衝突しないことを確かめる
  IF EXISTS (SELECT 1 FROM public.ow_industries WHERE slug = 'manufacturing') THEN
    RAISE EXCEPTION 'slug ''manufacturing'' が既にある。中止';
  END IF;

  -- 現状は全件フラット
  SELECT count(*) INTO v_n FROM public.ow_industries WHERE parent_id IS NOT NULL;
  IF v_n <> 0 THEN RAISE EXCEPTION '既に parent_id を持つ行が % 件ある。中止', v_n; END IF;

  -- 子にする4値が実在すること
  SELECT count(*) INTO v_n FROM public.ow_industries
   WHERE slug IN ('electronics-semiconductor','machinery','materials-chemicals','food-beverage')
     AND is_active;
  IF v_n <> 4 THEN RAISE EXCEPTION '子にする4値が揃っていない（% 件）', v_n; END IF;
END $$;

-- ★変更前の並びを控える（事後に「17値の相対順が変わっていない」ことを確かめる）
CREATE TEMP TABLE _order_before ON COMMIT DROP AS
SELECT slug, name, display_order,
       row_number() OVER (ORDER BY display_order) AS rn
  FROM public.ow_industries WHERE is_active;

-- ── 1. 親を作る ────────────────────────────────────────────────────────────
--   ⚠️ `requires_business_domain` は false。事業領域（軸1の細分）は
--      IT・ソフトウェア／電子機器・半導体だけが要求している既存の運用に合わせる。
INSERT INTO public.ow_industries (name, slug, display_order, is_active, requires_business_domain, description)
VALUES ('製造業', 'manufacturing', 2, true, false,
        'ものを作る会社。下の4つから近いものを選べます（分からなければ「製造業」のままで構いません）');

-- ── 2. 既存4値を子にする ──────────────────────────────────────────────────
--   ⚠️ display_order は**親ごとの相対順**に振り直す（ow_roles と同じ）。
--      旧の並び（電子機器2 → 電機・機械4 → 素材・化学5 → 食品・飲料7）を保つ。
UPDATE public.ow_industries AS i
   SET parent_id = (SELECT id FROM public.ow_industries WHERE slug = 'manufacturing'),
       display_order = v.ord
  FROM (VALUES
    ('electronics-semiconductor', 1),
    ('machinery',                 2),
    ('materials-chemicals',       3),
    ('food-beverage',             4)
  ) AS v(slug, ord)
 WHERE i.slug = v.slug;

-- ── 3. トップレベルを詰め直す ──────────────────────────────────────────────
--   ⚠️★17値の**相対順は変えない**。製造業を旧2番（電子機器・半導体の位置）に置き、
--      以降を1つずつ詰める。
UPDATE public.ow_industries AS i
   SET display_order = v.ord
  FROM (VALUES
    ('it-software',                     1),
    -- 2 は manufacturing（上で INSERT 済み）
    ('telecom',                         3),
    ('energy-infrastructure',           4),
    ('food-service',                    5),
    ('trading-wholesale',               6),
    ('retail-distribution',             7),
    ('finance-insurance',               8),
    ('realestate',                      9),
    ('construction',                   10),
    ('logistics',                      11),
    ('healthcare',                     12),
    ('education',                      13),
    ('hr-services',                    14),
    ('consulting',                     15),
    ('media-advertising-entertainment',16),
    ('public-organization',            17),
    ('other-services',                 18)
  ) AS v(slug, ord)
 WHERE i.slug = v.slug;

COMMENT ON COLUMN public.ow_industries.parent_id IS
  '2階層の親。⚠ 2026-09-05 から「製造業」だけが親を持つ（子は 電子機器・半導体 / 電機・機械 / '
  '素材・化学 / 食品・飲料）。⚠ 孫は作らない。'
  '⚠★突合で祖先展開するのは**本人側だけ**（src/lib/companies/industryTree.ts）。'
  '企業の対象業界は展開しない —— 展開すると兄弟に広がり、'
  '「電子機器・半導体向け」の企業に 電機・機械 出身の人が当たってしまう。'
  '⚠ display_order は**親ごとの相対順**（ow_roles と同じ）。トップレベルは 1〜18、子は親の中で 1〜4。';

-- ── 4. 事後チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_n int; v_bad text;
BEGIN
  SELECT count(*) INTO v_n FROM public.ow_industries WHERE is_active;
  IF v_n <> 22 THEN RAISE EXCEPTION '有効な業種が22件でない（% 件）', v_n; END IF;

  SELECT count(*) INTO v_n FROM public.ow_industries WHERE parent_id IS NOT NULL AND is_active;
  IF v_n <> 4 THEN RAISE EXCEPTION '子が4件でない（% 件）', v_n; END IF;

  -- ⚠️ 孫を作っていないこと
  IF EXISTS (SELECT 1 FROM public.ow_industries c JOIN public.ow_industries p ON p.id = c.parent_id
              WHERE p.parent_id IS NOT NULL) THEN
    RAISE EXCEPTION '孫ができている'; END IF;

  -- ★階層を持たない17値の**相対順が変わっていない**こと
  SELECT string_agg(b.name, ' / ') INTO v_bad
    FROM (SELECT slug, name, row_number() OVER (ORDER BY display_order) AS rn
            FROM public.ow_industries
           WHERE is_active AND parent_id IS NULL AND slug <> 'manufacturing') a
    JOIN (SELECT slug, name, row_number() OVER (ORDER BY rn) AS rn
            FROM _order_before
           WHERE slug NOT IN ('electronics-semiconductor','machinery','materials-chemicals','food-beverage')) b
      ON b.slug = a.slug
   WHERE a.rn <> b.rn;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '17値の相対順が変わった: %', v_bad;
  END IF;

  -- ★既存企業の industry_id を付け替えていないこと（子はそのまま）
  SELECT count(*) INTO v_n FROM public.ow_companies c
    JOIN public.ow_industries i ON i.id = c.industry_id
   WHERE i.slug = 'electronics-semiconductor';
  IF v_n <> 7 THEN RAISE EXCEPTION '電子機器・半導体の企業が7社でない（% 社）', v_n; END IF;
  IF EXISTS (SELECT 1 FROM public.ow_companies c JOIN public.ow_industries i ON i.id=c.industry_id
              WHERE i.slug = 'manufacturing') THEN
    RAISE EXCEPTION '親（製造業）を直接指す企業ができている。親は空の器のはず'; END IF;

  RAISE NOTICE '事後チェック OK: 有効22件（トップ18 + 子4）/ 孫0 / 17値の相対順は不変 / 付け替え0';
END $$;

COMMIT;
