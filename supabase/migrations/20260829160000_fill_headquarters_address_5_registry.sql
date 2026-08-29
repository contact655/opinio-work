-- ═══════════════════════════════════════════════════════════════════════════
-- 本社住所を5社に入れる（2026-08-29 / 第5バッチ・登記情報）
-- 出所: 国税庁 法人番号公表サイト（`20260829150000` と同じ）
--
-- ── どう見つけたか ──────────────────────────────────────────────────────────
-- 第4バッチでヒットしなかった企業を、**登記名の表記を変えて**引き直した。
-- DB の社名は英字やブランド名で、登記名がカタカナのことが多い。
--
--   CrowdStrike株式会社      → 「クラウドストライク合同会社」
--   DocuSign Japan株式会社   → 「ドキュサイン・ジャパン株式会社」
--   フォーティネット株式会社      → 「フォーティネットジャパン合同会社」
--
-- ⚠️ **候補が1件だけで、社名が明確に対応するものに限った。**
--
-- ── ⚠️★入れなかったもの（判別できない）──────────────────────────────────────
-- | 企業 | 理由 |
-- |---|---|
-- | キリバ | 「キリバ・ジャパン株式会社」がヒット。**DB名は「キリバ株式会社」で法人格が違う** |
-- | ヴイエムウェア | 「ヴイエムウェアヴイクラウドサービス合同会社」のみ。別法人の可能性 |
-- | **パランティア** | 「合同会社パランティア」（南青山のビル202号室）。**規模が合わない。同名の別法人の疑い** |
-- | アップルジャパン | 3件とも別法人。日本法人は「Apple Japan合同会社」でヒットせず |
-- | エラスティック | 「エラスティック合同会社」が2件（町田・日本橋）。判別できない |
-- | ザクトリー | 「イグザクトリー」しか出ない。別会社 |
-- | Box / SAP / シスコ / ブラックライン / インテル / コング | 第4バッチと同じ（誤ヒット・複数ヒット） |
--
-- ⚠️★**社名が似ているだけで入れないこと。** 部分一致検索なので、
--    「Box Japan」で Sandbox VR Japan が、「メタ」でアークメタルが出る。
--    **候補が複数出たら入れない**を原則にした。
--
-- ── ヒットしなかった企業（名前の当てずっぽうを止めた）──────────────────────
-- Snowflake / ウーバー / アプティオ / アリスタネットワークス / アンソロピック /
-- ウォークミー / エヌシーノ / クラウドフレア / クリックハウス / ゲインサイト /
-- コンフルエント / ノービフォー / Meta / ミラクル
-- → **企業から預かるか、法人番号を個別に調べるしかない。**
--   ここが機械で進められる限界（2026-08-29 の判断）。
--
-- ⚠️ この5社も**登記上の本店**で、企業サイト由来の31社とは意味が違う。
--    詳細は `20260829150000` のコメントを参照。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260829-2304-ow_companies.sql（スキーマ+データ / 89行）
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_filled int; v_target int;
BEGIN
  SELECT count(*) INTO v_filled FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_filled <> 48 THEN RAISE EXCEPTION '住所ありが % 社（48 のはず）。中止', v_filled; END IF;

  SELECT count(*) INTO v_target FROM public.ow_companies
   WHERE id IN ('87bcae88-2779-4bf7-b461-b3c8661b2764','da8cfab5-f5c2-4648-b866-895be46a1494',
                '3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2','e4d317d3-48b9-4718-ae3e-8d27147d05f5',
                'cb386dd2-427c-49d1-b3f8-1e1d3a921fd8')
     AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');
  IF v_target <> 5 THEN RAISE EXCEPTION '空の対象が % 社（5 のはず）。中止', v_target; END IF;
  RAISE NOTICE '適用前: 住所あり % 社', v_filled;
END $$;

UPDATE public.ow_companies SET headquarters_address='東京都港区赤坂5-3-1 赤坂Bizタワー29階'
 WHERE id='87bcae88-2779-4bf7-b461-b3c8661b2764' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都港区虎ノ門4-3-1 城山トラストタワー35階'
 WHERE id='da8cfab5-f5c2-4648-b866-895be46a1494' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都港区六本木7-7-7 TRI-SEVEN ROPPONGI 9階'
 WHERE id='3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都港区六本木6-10-1 六本木ヒルズ森タワー'
 WHERE id='e4d317d3-48b9-4718-ae3e-8d27147d05f5' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都港区赤坂1-14-15 第35興和ビル別館2F'
 WHERE id='cb386dd2-427c-49d1-b3f8-1e1d3a921fd8' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');

DO $$
DECLARE v_filled int; v_target int; v_bad int; v_total int;
BEGIN
  SELECT count(*) INTO v_filled FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_filled <> 53 THEN RAISE EXCEPTION '住所ありが % 社（48+5=53 のはず）。中止', v_filled; END IF;

  SELECT count(*) INTO v_target FROM public.ow_companies
   WHERE id IN ('87bcae88-2779-4bf7-b461-b3c8661b2764','da8cfab5-f5c2-4648-b866-895be46a1494',
                '3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2','e4d317d3-48b9-4718-ae3e-8d27147d05f5',
                'cb386dd2-427c-49d1-b3f8-1e1d3a921fd8')
     AND headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_target <> 5 THEN RAISE EXCEPTION '埋まったのが % 社（5 のはず）。中止', v_target; END IF;

  /* ⚠️ `丁目` は建物名にも入る（Databricks の「日本橋三丁目スクエア」）。
        弾くのは**数字の直後**だけ（`20260829150000` で一度これに引っかかった）。 */
  SELECT count(*) INTO v_bad FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> ''
     AND (headquarters_address LIKE '%〒%' OR headquarters_address ~ '[０-９]'
          OR headquarters_address ~ '[0-9]丁目'
          OR headquarters_address !~ '^(北海道|東京都|大阪府|京都府|.{2,3}県)');
  IF v_bad <> 0 THEN RAISE EXCEPTION '書式が想定と違う行が % 件。中止', v_bad; END IF;

  SELECT count(*) INTO v_total FROM public.ow_companies;
  IF v_total <> 89 THEN RAISE EXCEPTION 'ow_companies が % 行（89 のはず）。中止', v_total; END IF;
  RAISE NOTICE '完了: 住所あり % 社（+5）/ 書式違反 % 件', v_filled, v_bad;
END $$;

COMMIT;
