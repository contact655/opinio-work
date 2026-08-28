-- ═══════════════════════════════════════════════════════════════════════════
-- 本社所在地を7社ぶん埋める（2026-08-28）
--
-- ── ★先に結論: この項目は自動化できない ────────────────────────────────────
-- `headquarters_address` が空なのは**掲載79社中67社**。全社を機械的に埋めようとしたが、
-- **実測の取得成功率は 67社中7社（約10%）**だった。
--   * 大半が外資系の日本法人で、グローバルサイトに日本法人の住所が載っていない
--   * 載っていても Akamai 等の bot 対策で **403 / 406 / タイムアウト**（SAP・Box・
--     ServiceNow・Slack・Zendesk ほか多数）
--   * ⚠️★**正規表現の抽出は誤検出を出す。** 試作では DocuSign の**電話番号**
--     「588-5476」を住所として拾った。**そのまま入れていたら嘘のデータになっていた。**
--
-- → **一括投入はしない。** 取れた7件だけを、**1件ずつ出典ページの前後の文まで目視で
--    確認して**入れる。残り60社は**人が公式サイトを見るか、企業から預かる**しかない。
--    （CLAUDE.md「推測値を投入しない」「値が無いことを、ある値に置き換えない」）
--
-- ── 入れる7件（すべて各社の自社サイト。ラベル付きで明記されていたものだけ）──────
--   Asana Japan          https://asana.com/ja/about            「東京 〒100-6990 …」
--   Indeed Japan         https://jp.indeed.com/about           「Indeed Japan 株式会社 …」
--   New Relic            https://newrelic.com/jp/about         「所在地 …」
--   パロアルトネットワークス https://www.paloaltonetworks.jp/company 「住所: 東京 …」
--   ブレイズ              https://www.braze.com/ja/company      「日本オフィス所在地 : …」
--   ページャーデューティー  https://www.pagerduty.co.jp/company   「PagerDuty株式会社 …」
--   日本IBM              https://www.ibm.com/jp-ja/about       「本社所在地 …」
--
-- ⚠️★**Indeed は同じページに2つの法人が載っている。**
--    「Indeed Japan株式会社」＝丸の内 / 「Indeed **Technologies** Japan株式会社」＝港区芝。
--    **当社の行は前者**なので丸の内を採った。**別法人の住所を入れないこと。**
--
-- ⚠️★**ブレイズとページャーデューティーは住所が同じ**（港区赤坂9-7-1 ミッドタウンタワー18F）。
--    誤りではなく、**両社とも同じシェアオフィスに入っている**（ブレイズのページに
--    「ワークスタイリング東京ミッドタウン内」と明記）。**重複と見て消さないこと。**
--
-- ── 書式は既存12社に揃える ──────────────────────────────────────────────────
-- **〒 は付けない / 番地は半角ハイフン / 建物名を続ける**
-- （例: 既存の `東京都千代田区丸の内2-7-2 JPタワー`）。
-- 出典が「二丁目6番1号」の表記でも `2-6-1` に直す。
--
-- ── ついでに1件（拠点）──────────────────────────────────────────────────────
-- パロアルトネットワークスの `branch_locations` は `{大阪}` だが、
-- 上の同じページに **大阪と名古屋の両方**が載っている（名古屋 〒450-0002 愛知県名古屋市
-- 中村区名駅3-28-…）。**名古屋を足す。**
-- ⚠️ 既存の「大阪」は消さない（CLAUDE.md「出典が無いことだけを根拠に既存の値を削除しない」）。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260828-1807-ow_companies.sql（スキーマ+データ / 88行）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_before int; v_found int;
BEGIN
  SELECT count(*) INTO v_before FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND headquarters_address <> '';
  IF v_before <> 12 THEN
    RAISE EXCEPTION '本社住所が入っている企業が % 社（12 のはず）。前提が違う。中止', v_before;
  END IF;

  -- ★対象7社がすべて実在し、かつ**まだ空**であること（上書きしない）
  SELECT count(*) INTO v_found FROM public.ow_companies
   WHERE name IN ('Asana Japan株式会社','Indeed Japan株式会社','New Relic株式会社',
                  'パロアルトネットワークス株式会社','ブレイズ株式会社',
                  'ページャーデューティー株式会社','日本IBM株式会社')
     AND (headquarters_address IS NULL OR headquarters_address = '');
  IF v_found <> 7 THEN
    RAISE EXCEPTION '対象が % 社（7 のはず）。名前が変わったか、既に入っている。中止', v_found;
  END IF;

  RAISE NOTICE '適用前: 本社住所あり % 社 / 対象 % 社', v_before, v_found;
END $$;

/* ⚠️ 対象は name で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
      ⚠️ さらに `headquarters_address IS NULL` を条件に入れて、**既存値を上書きしない**。 */
UPDATE public.ow_companies SET headquarters_address = '東京都千代田区丸の内2-6-1 丸の内パークビルディング8F'
 WHERE name = 'Asana Japan株式会社'            AND (headquarters_address IS NULL OR headquarters_address = '');
UPDATE public.ow_companies SET headquarters_address = '東京都千代田区丸の内1-9-2 グラントウキョウサウスタワー'
 WHERE name = 'Indeed Japan株式会社'           AND (headquarters_address IS NULL OR headquarters_address = '');
UPDATE public.ow_companies SET headquarters_address = '東京都中央区八重洲2-2-1 東京ミッドタウン八重洲 八重洲セントラルタワー7F'
 WHERE name = 'New Relic株式会社'              AND (headquarters_address IS NULL OR headquarters_address = '');
UPDATE public.ow_companies SET headquarters_address = '東京都千代田区内幸町2-1-6 日比谷パークフロント15F'
 WHERE name = 'パロアルトネットワークス株式会社' AND (headquarters_address IS NULL OR headquarters_address = '');
UPDATE public.ow_companies SET headquarters_address = '東京都港区赤坂9-7-1 ミッドタウンタワー18F'
 WHERE name = 'ブレイズ株式会社'                AND (headquarters_address IS NULL OR headquarters_address = '');
UPDATE public.ow_companies SET headquarters_address = '東京都港区赤坂9-7-1 ミッドタウン・タワー18F'
 WHERE name = 'ページャーデューティー株式会社'   AND (headquarters_address IS NULL OR headquarters_address = '');
UPDATE public.ow_companies SET headquarters_address = '東京都港区虎ノ門2-6-1 虎ノ門ヒルズ ステーションタワー'
 WHERE name = '日本IBM株式会社'                AND (headquarters_address IS NULL OR headquarters_address = '');

/* パロアルトの拠点に名古屋を足す。⚠️ 既存の「大阪」は残す */
UPDATE public.ow_companies
   SET branch_locations = ARRAY['大阪','名古屋']
 WHERE name = 'パロアルトネットワークス株式会社'
   AND branch_locations = ARRAY['大阪'];   -- ★いまの値まで確認してから書き換える

DO $$
DECLARE v_after int; v_empty int; v_pan text[];
BEGIN
  SELECT count(*) INTO v_after FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND headquarters_address <> '';
  IF v_after <> 19 THEN RAISE EXCEPTION '本社住所あり % 社（12+7=19 のはず）。中止', v_after; END IF;

  -- ★7社とも実際に入ったこと
  SELECT count(*) INTO v_empty FROM public.ow_companies
   WHERE name IN ('Asana Japan株式会社','Indeed Japan株式会社','New Relic株式会社',
                  'パロアルトネットワークス株式会社','ブレイズ株式会社',
                  'ページャーデューティー株式会社','日本IBM株式会社')
     AND (headquarters_address IS NULL OR headquarters_address = '');
  IF v_empty <> 0 THEN RAISE EXCEPTION '% 社が空のまま。中止', v_empty; END IF;

  SELECT branch_locations INTO v_pan FROM public.ow_companies
   WHERE name = 'パロアルトネットワークス株式会社';
  IF v_pan <> ARRAY['大阪','名古屋'] THEN RAISE EXCEPTION '拠点が % 。中止', v_pan; END IF;

  RAISE NOTICE '完了: 本社住所あり % 社 / 空 % 社 / パロアルトの拠点 %', v_after, v_empty, v_pan;
END $$;

COMMIT;
