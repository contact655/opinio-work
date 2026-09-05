-- ============================================================================
-- 株式会社日本HP の本社住所を直す
--   誤: 東京都江東区大島2-2-1        ← 日本ヒューレット・パッカード（HPE）の住所
--   正: 東京都港区港南1-2-70 品川シーズンテラス
--
-- 作業前ダンプ: .dumps/20260905-1526-ow_companies-ow_company_data_sources.sql
-- ============================================================================
--
-- ── どうやって見つけたか ──────────────────────────────────────────────────
-- 読み仮名を入れる作業で法人番号公表サイトを引いたときに、登記の住所と
-- うちのデータが食い違っていることに気づいた。**2社に同じ住所が入っていた。**
--
-- ── ★出典（2つとも確認した）──────────────────────────────────────────────
-- ① 登記: 国税庁 法人番号公表サイト https://www.houjin-bangou.nta.go.jp/
--    「株式会社日本HP」で検索 → 該当1件
--      ニホンエイチピー 株式会社日本ＨＰ ／ 東京都港区港南１丁目２番７０号品川シーズンテラス
-- ② 公式: https://jp.ext.hp.com/hp-information/about-hpjapan/
--    会社概要「本社 東京都港区港南1丁目2番70号　品川シーズンテラス21階」
--
-- ⚠️ 階数（21階）は**入れない。** 登記に階数が無く、同じ列の他社
--    （日本マイクロソフト「品川グランドセントラルタワー」など）とも揃わないため。
--
-- ── ★原因 ────────────────────────────────────────────────────────────────
-- `ow_company_data_sources` は **`registry` 由来（2026-08-29 確認）** と記録している
-- （投入元: 20260829150000_fill_headquarters_address_17_registry.sql）。
-- **つまり「登記から取った」と記録されているのに、値が登記と違う。**
-- 同じ日に隣接して投入された HPE の住所（江東区大島2-2-1）が入っており、
-- **投入時に取り違えたと考えられる**（HPE 側の値は登記と一致しており正しい）。
--
-- ⚠️ **`source_kind` の記録は嘘をつかない、とは限らない。**
--    「registry と書いてあるから登記どおり」と読まないこと。
--
-- ── 住所が重複している他の企業（洗った結果）────────────────────────────────
--   東京都渋谷区道玄坂1-10-8 渋谷道玄坂東急ビル2F-C … 2社
--     → **誤りではない。** Notion Labs Japan / コング・ジャパン とも
--        登記が同じ住所（法人番号公表サイトで両方確認済み）。同じシェアオフィス。
--   東京都港区赤坂9-7-1 ミッドタウンタワー18階 … 6社
--     → ★**確認できなかった。** ミラクル株式会社・ゲインサイト・ジャパン株式会社は
--        法人番号公表サイトで**該当0件**（うちの社名が登記名と違う）。
--        誤りとも正しいとも言えないので**触っていない**。→ docs/todo.md

BEGIN;

-- ── 0. 事前チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_addr text;
BEGIN
  SELECT headquarters_address INTO v_addr FROM public.ow_companies WHERE name = '株式会社日本HP';
  IF v_addr IS DISTINCT FROM '東京都江東区大島2-2-1' THEN
    RAISE EXCEPTION '日本HP の住所が想定と違う（%）。既に直っているか別の値。中止', v_addr;
  END IF;
  -- ⚠️ HPE 側は**正しい**ので触らない。値が変わっていないことを確かめる
  SELECT headquarters_address INTO v_addr FROM public.ow_companies
   WHERE name = '日本ヒューレット・パッカード合同会社';
  IF v_addr IS DISTINCT FROM '東京都江東区大島2-2-1' THEN
    RAISE EXCEPTION 'HPE の住所が想定と違う（%）。中止', v_addr;
  END IF;
END $$;

-- ── 1. 住所を直す（★対象は社名で明示。HPE は触らない）──────────────────────
UPDATE public.ow_companies
   SET headquarters_address = '東京都港区港南1-2-70 品川シーズンテラス'
 WHERE name = '株式会社日本HP';

-- ── 2. 出典を更新する ──────────────────────────────────────────────────────
--   ⚠️ `ow_company_data_sources.field` の CHECK は `headquarters_address` のみを許す
--      （実測で確認）。主キーは (company_id, field) なので既存行を UPDATE する。
UPDATE public.ow_company_data_sources AS s
   SET source_kind = 'registry',
       source_url  = 'https://www.houjin-bangou.nta.go.jp/',
       verified_at = now(),
       note        = '2026-09-05 訂正。以前は江東区大島2-2-1（HPEの住所）が入っていた。'
                     '登記（法人番号公表サイト「株式会社日本HP」該当1件）と'
                     '公式サイト https://jp.ext.hp.com/hp-information/about-hpjapan/ の両方で確認。'
                     '⚠ 階数（21階）は登記に無いので入れていない。'
  FROM public.ow_companies c
 WHERE c.id = s.company_id AND s.field = 'headquarters_address'
   AND c.name = '株式会社日本HP';

-- ── 3. 事後チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_n int; v_addr text; v_note text;
BEGIN
  SELECT headquarters_address INTO v_addr FROM public.ow_companies WHERE name = '株式会社日本HP';
  IF v_addr <> '東京都港区港南1-2-70 品川シーズンテラス' THEN
    RAISE EXCEPTION '住所が想定どおりに入っていない（%）', v_addr;
  END IF;

  -- ★HPE 側が巻き添えになっていないこと
  SELECT headquarters_address INTO v_addr FROM public.ow_companies
   WHERE name = '日本ヒューレット・パッカード合同会社';
  IF v_addr <> '東京都江東区大島2-2-1' THEN
    RAISE EXCEPTION 'HPE の住所を壊した（%）', v_addr;
  END IF;

  -- 出典が更新されていること
  SELECT s.note INTO v_note FROM public.ow_company_data_sources s
    JOIN public.ow_companies c ON c.id = s.company_id
   WHERE c.name = '株式会社日本HP' AND s.field = 'headquarters_address';
  IF v_note IS NULL OR v_note NOT LIKE '%2026-09-05 訂正%' THEN
    RAISE EXCEPTION '出典が更新されていない'; END IF;

  -- ★HPE と同じ住所の企業がいなくなったこと
  SELECT count(*) INTO v_n FROM public.ow_companies
   WHERE headquarters_address = '東京都江東区大島2-2-1';
  IF v_n <> 1 THEN RAISE EXCEPTION '江東区大島2-2-1 の企業が % 社ある（1社のはず）', v_n; END IF;

  RAISE NOTICE '事後チェック OK: 日本HP の住所を訂正 / HPE は無傷 / 出典を更新';
END $$;

COMMIT;
