-- ============================================================================
-- 業種「インターネット・Webサービス」を「IT・ソフトウェア」に統合する
--
-- ── なぜ ──────────────────────────────────────────────────────────────────
-- ⚠️★**求職者がこの2つを区別できず、間違えると業界マッチが外れる。**
--    自分の勤務先の業種を選ばせる画面を作るにあたって、
--    「SaaS企業は IT・ソフトウェアか、インターネット・Webサービスか」で迷う。
--    後者を選ぶと、対象業界が `it-software` の企業（ゲインサイト / Opinio）と
--    **一致しなくなる。** 迷う3組のうち、**今日作った機能に直接効く唯一の組**。
--
-- ⚠️ 残り2組は統合しない（2026-09-04 / 柴さん）:
--    ・「商社・卸売 / 小売・流通」… 意味が違う。**選択肢に短い説明を付ける**で対処
--    ・「電機・機械 / 電子機器・半導体」＋**製造業一般が無い**問題
--      … 統合では解決しない。**2階層＋祖先展開の宿題**（docs に残す）。今回は触らない
--
-- ── ?industry= への影響 → **無い**（適用前に確認済み）────────────────────────
--   ⚠️ `?industry=` の値は**事業領域（`ow_business_domains`）の slug**であって、
--      業種（`ow_industries`）の slug ではない（`searchCompanies` は
--      `ow_business_domains.slug` で引く）。
--   ⚠️ `LEGACY_KEYS` は fintech / ec / healthcare の3つだけ。`internet-web` は無い。
--   ⚠️ `internet-web` は **src からの参照が0件**（migration 2本にしか出てこない）。
--   → **0件になる導線は生まれない。**
--
-- 作業前ダンプ: .dumps/20260904-2236-ow_industries-ow_companies.sql
-- ============================================================================

BEGIN;

-- ── 0. 事前チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_n int; v_it int; v_req boolean;
BEGIN
  SELECT count(*) INTO v_n FROM public.ow_companies c
    JOIN public.ow_industries i ON i.id = c.industry_id WHERE i.slug = 'internet-web';
  -- ⚠️ 掲載中2社（ミラクル / ウーバー）＋ draft 1社（やめるラボ）の **3社**。
  --    フェーズ0で「2社」と報告したのは掲載中だけを数えていたため。**3社が正**。
  IF v_n <> 3 THEN
    RAISE EXCEPTION '「インターネット・Webサービス」の企業が 3 社でない（% 社）。中止', v_n;
  END IF;

  SELECT count(*) INTO v_it FROM public.ow_industries WHERE slug = 'it-software' AND is_active;
  IF v_it <> 1 THEN RAISE EXCEPTION '統合先 it-software が見つからない'; END IF;

  /* ⚠️ 統合先も `requires_business_domain` が同じであること。違うと、
        付け替えた瞬間に公開ゲートの条件が変わる（掲載中の企業が条件を満たさなくなる）。 */
  SELECT requires_business_domain INTO v_req FROM public.ow_industries WHERE slug = 'internet-web';
  IF v_req IS DISTINCT FROM (SELECT requires_business_domain FROM public.ow_industries WHERE slug = 'it-software') THEN
    RAISE EXCEPTION 'requires_business_domain が統合元と統合先で違う。公開ゲートの条件が変わるので中止';
  END IF;
END $$;

/* ★事後チェックのために**適用前の件数を控える**。
   ⚠️ 期待値をベタ書きしない。最初 `77 + 3 = 80` と書いて**失敗した**
      （77 はフェーズ0時点の値で、その後 建設テック4社を足していた）。
      **移動前後の差**で見れば、母数が変わっても壊れない。 */
CREATE TEMP TABLE _merge_before ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public.ow_companies c JOIN public.ow_industries i ON i.id=c.industry_id
    WHERE i.slug='it-software')   AS it_before,
  (SELECT count(*) FROM public.ow_companies c JOIN public.ow_industries i ON i.id=c.industry_id
    WHERE i.slug='internet-web')  AS iw_before;

-- ── 1. 3社を付け替える ────────────────────────────────────────────────────
--   ⚠️ 対象は slug で明示。**社名の一括 UPDATE にしない**（CLAUDE.md）。
UPDATE public.ow_companies
   SET industry_id = (SELECT id FROM public.ow_industries WHERE slug = 'it-software')
 WHERE industry_id = (SELECT id FROM public.ow_industries WHERE slug = 'internet-web');

-- ── 2. 値は論理削除（★物理DELETEしない）──────────────────────────────────
--   ⚠️ 選択肢マスタの削除は `is_active = false` が正。FK は ON DELETE RESTRICT で
--      守られており、そもそも参照が残っていれば物理削除はできない。
UPDATE public.ow_industries
   SET is_active = false, display_order = 98
 WHERE slug = 'internet-web';

-- 並び順を詰め直す。⚠️ slug を明示列挙する
UPDATE public.ow_industries AS i
   SET display_order = v.ord
  FROM (VALUES
    ('it-software', 1), ('electronics-semiconductor', 2), ('telecom', 3),
    ('machinery', 4), ('materials-chemicals', 5), ('energy-infrastructure', 6),
    ('food-beverage', 7), ('food-service', 8), ('trading-wholesale', 9),
    ('retail-distribution', 10), ('finance-insurance', 11), ('realestate', 12),
    ('construction', 13), ('logistics', 14), ('healthcare', 15), ('education', 16),
    ('hr-services', 17), ('consulting', 18), ('media-advertising-entertainment', 19),
    ('public-organization', 20), ('other-services', 21)
  ) AS v(slug, ord)
 WHERE i.slug = v.slug;

COMMENT ON COLUMN public.ow_industries.slug IS
  '安定キー。⚠ `food-beverage` は食品・飲料の**メーカー側**、`food-service` は**外食・飲食店**。別物なので統合しないこと。⚠ `realestate-construction`（不動産・建設）は 2026-09-04 に不動産と建設へ分割し、is_active = false にした行。⚠ `internet-web`（インターネット・Webサービス）は 2026-09-04 に `it-software` へ統合し、is_active = false にした行（求職者が2つを区別できず、間違えると業界マッチが外れるため）';

-- ── 3. 事後チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_active int; v_left int; v_it int; v_expect int;
BEGIN
  SELECT count(*) INTO v_active FROM public.ow_industries WHERE is_active = true;
  IF v_active <> 21 THEN RAISE EXCEPTION '有効な業種が 21 件でない（% 件）', v_active; END IF;

  SELECT count(*) INTO v_left FROM public.ow_companies c
    JOIN public.ow_industries i ON i.id = c.industry_id WHERE i.slug = 'internet-web';
  IF v_left <> 0 THEN RAISE EXCEPTION 'まだ % 社が internet-web を参照している', v_left; END IF;

  -- ★IT・ソフトウェアは「元の数 ＋ 移した数」になる（ベタ書きしない）
  SELECT count(*) INTO v_it FROM public.ow_companies c
    JOIN public.ow_industries i ON i.id = c.industry_id WHERE i.slug = 'it-software';
  SELECT it_before + iw_before INTO v_expect FROM _merge_before;
  IF v_it <> v_expect THEN
    RAISE EXCEPTION 'IT・ソフトウェアが % 社でない（% 社）', v_expect, v_it;
  END IF;

  -- ⚠️ 業種が NULL の企業を作っていないこと
  IF EXISTS (SELECT 1 FROM public.ow_companies WHERE industry_id IS NULL) THEN
    RAISE EXCEPTION '業種が NULL の企業ができている';
  END IF;

  RAISE NOTICE '事後チェック OK: 有効な業種 % 件 / IT・ソフトウェア % 社（元 % ＋ 移動 %）', v_active, v_it, (SELECT it_before FROM _merge_before), (SELECT iw_before FROM _merge_before);
END $$;

COMMIT;
