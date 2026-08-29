-- ═══════════════════════════════════════════════════════════════════════════
-- 本社住所を20社に入れる（2026-08-29 / 第6バッチ・登記情報）
-- 出所: 国税庁 法人番号公表サイト（`20260829150000` `20260829160000` と同じ）
--
-- ── ★決め手は「英字での検索」だった ────────────────────────────────────────
-- カナで推測しても当たらなかった企業が、**英語表記を検索対象に含める**
-- （`enCkbx=on`）だけで一気に見つかった。
--
--   ゲインサイト → ヒットせず  ／  "Gainsight" → **Ｇａｉｎｓｉｇｈｔ株式会社**
--   エヌシーノ   → ヒットせず  ／  "nCino"     → **ｎＣｉｎｏ株式会社**
--   ザクトリー   → イグザクトリーしか出ない ／ "Xactly" → **Ｘａｃｔｌｙ株式会社**
--
-- ⚠️ **外資系日本法人は登記名が英字のことが多い。** カナだけで探して
--    「登記が無い」と判断しないこと。
--
-- ── ⚠️★同名法人の判別 ──────────────────────────────────────────────────────
-- シスコ・ブラックライン・インテルは同名の別法人が複数あった。
-- **カナ読みが登録されている行**を採った（一覧の「商号又は名称」にカナが併記される）。
-- 練馬のマンション・愛知の県営住宅・大阪のメゾンにある同名法人にはカナが無く、
-- 所在地がオフィスビルであることとも一致する。
--
-- ── ⚠️★赤坂9-7-1 ミッドタウンタワー18階に6社が集中している ──────────────────
-- ClickHouse / Gainsight / Mirakl / nCino / Xactly / BlackLine。
-- **レンタルオフィスか法人設立代行の住所と思われ、実際の勤務地とは限らない。**
-- 登記としては正しいが、「そこに行けば会える」とは限らないことを承知で入れている。
--
-- ── ⚠️ 入れなかった6社 ─────────────────────────────────────────────────────
-- | 企業 | 理由 |
-- |---|---|
-- | **Box Japan** | 何度探しても別会社しか出ない（Sandbox VR / Chatterbox / TourBox / FASTBOX） |
-- | **Meta日本法人** | 「Meta Platforms Technologies Japan合同会社」はあるが、**DB名がどの法人を指すか不明** |
-- | Snowflake Japan | 山口・埼玉・沖縄の無関係な snowflake しか出ない |
-- | キリバ | 「キリバ・ジャパン株式会社」。**法人格が違う** |
-- | エラスティック | 「Elasticsearch株式会社」が有力だが**社名が違う** |
-- | **パランティア** | **株式会社（神宮前）と合同会社（道玄坂）の2つが実在**。判別できない |
--
-- ⚠️ この6社は**空のままにする。** 誤った住所を入れるほうが空欄より害が大きい。
--
-- ⚠️ この20社も**登記上の本店**。企業サイト由来の12社とは意味が違う
--    （詳細は `20260829150000` のコメント）。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260829-2323-ow_companies.sql（スキーマ+データ / 89行）
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_filled int; v_target int;
BEGIN
  SELECT count(*) INTO v_filled FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_filled <> 53 THEN RAISE EXCEPTION '住所ありが % 社（53 のはず）。中止', v_filled; END IF;
  SELECT count(*) INTO v_target FROM public.ow_companies
   WHERE id IN ('9ccf1640-6a5c-42e3-bbcf-4110f715fbf4','1241f8a5-b645-4aa2-9fa1-bbfc573f1774','4fecbf31-498c-40b0-a04e-3a6cb978433f','e459ac79-5dad-499d-bb65-b758d4281123','1413b97e-ef19-4e40-87ae-e31ac8996bdd','3efd857e-315c-4650-9727-1e5aa1245753','f32e6905-f25f-4c01-b64f-c5695fd45a1d','53ea9a54-feef-413b-8a7c-e31e4def2e11','e3eafa66-02ce-4060-a5fe-57e4317c8e7c','08e4aff6-a12c-4963-ad43-960ac9e39967','0a216ebb-c1fa-4d19-b066-f45e45c3ba2e','99132c64-ff07-4945-aeb6-7e21e6c256c9','7dac3c6e-bc5f-4550-9170-4338ea809be2','b8aa0e3d-828c-4bbe-b588-88450aab5739','355ce5c6-0412-4512-8864-1d477c97c917','bcea5e4e-94ee-4019-8ce3-237a7edf79a7','dcd2c652-4335-4031-b4d2-a4f22c98182b','27988ac1-fd93-445d-a9fd-6dad74c92686','ec97fde1-6f22-4ab5-89ee-9cea0b258f2a','943620b5-0fa2-48b4-a072-d47f900ba9f0')
     AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');
  IF v_target <> 20 THEN RAISE EXCEPTION '空の対象が % 社（20 のはず）。中止', v_target; END IF;
  RAISE NOTICE '適用前: 住所あり % 社', v_filled;
END $$;

UPDATE public.ow_companies SET headquarters_address='東京都新宿区西新宿3-3-13 西新宿水間ビル6F'
 WHERE id='9ccf1640-6a5c-42e3-bbcf-4110f715fbf4' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- コンフルエント合同会社
UPDATE public.ow_companies SET headquarters_address='東京都港区赤坂9-7-1 ミッドタウンタワー18階'
 WHERE id='1241f8a5-b645-4aa2-9fa1-bbfc573f1774' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- ザクトリー株式会社
UPDATE public.ow_companies SET headquarters_address='東京都港区赤坂9-7-1 ミッドタウンタワー18階'
 WHERE id='4fecbf31-498c-40b0-a04e-3a6cb978433f' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- ゲインサイト・ジャパン株式会社
UPDATE public.ow_companies SET headquarters_address='東京都渋谷区道玄坂1-10-8 渋谷道玄坂東急ビル2F-C'
 WHERE id='e459ac79-5dad-499d-bb65-b758d4281123' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- コング・ジャパン株式会社
UPDATE public.ow_companies SET headquarters_address='東京都港区赤坂9-7-1 ミッドタウンタワー18階'
 WHERE id='1413b97e-ef19-4e40-87ae-e31ac8996bdd' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- クリックハウス株式会社
UPDATE public.ow_companies SET headquarters_address='東京都豊島区東池袋3-1-1 サンシャイン60'
 WHERE id='3efd857e-315c-4650-9727-1e5aa1245753' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- アリスタネットワークス合同会社
UPDATE public.ow_companies SET headquarters_address='東京都千代田区丸の内2-4-1 丸の内ビルディング27階'
 WHERE id='f32e6905-f25f-4c01-b64f-c5695fd45a1d' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- アンソロピックジャパン合同会社
UPDATE public.ow_companies SET headquarters_address='東京都港区赤坂9-7-1 ミッドタウンタワー18階'
 WHERE id='53ea9a54-feef-413b-8a7c-e31e4def2e11' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- ブラックライン株式会社
UPDATE public.ow_companies SET headquarters_address='東京都中央区日本橋室町2-1-1 日本橋三井タワー6階'
 WHERE id='e3eafa66-02ce-4060-a5fe-57e4317c8e7c' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- ウォークミー株式会社
UPDATE public.ow_companies SET headquarters_address='東京都千代田区丸の内1-6-5'
 WHERE id='08e4aff6-a12c-4963-ad43-960ac9e39967' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- アプティオ株式会社
UPDATE public.ow_companies SET headquarters_address='東京都中央区京橋2-2-1 京橋エドグラン26階'
 WHERE id='0a216ebb-c1fa-4d19-b066-f45e45c3ba2e' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- クラウドフレア・ジャパン株式会社
UPDATE public.ow_companies SET headquarters_address='東京都中央区日本橋3-9-1 日本橋三丁目スクエア11階'
 WHERE id='99132c64-ff07-4945-aeb6-7e21e6c256c9' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- ノービフォー株式会社
UPDATE public.ow_companies SET headquarters_address='東京都港区芝浦3-1-1 田町ステーションタワーN18階'
 WHERE id='7dac3c6e-bc5f-4550-9170-4338ea809be2' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- ヴイエムウェア株式会社
UPDATE public.ow_companies SET headquarters_address='東京都港区赤坂9-7-1 ミッドタウンタワー18階'
 WHERE id='b8aa0e3d-828c-4bbe-b588-88450aab5739' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- エヌシーノ合同会社
UPDATE public.ow_companies SET headquarters_address='東京都港区赤坂9-7-1 ミッドタウンタワー18階'
 WHERE id='355ce5c6-0412-4512-8864-1d477c97c917' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- ミラクル株式会社
UPDATE public.ow_companies SET headquarters_address='東京都千代田区大手町1-2-1'
 WHERE id='bcea5e4e-94ee-4019-8ce3-237a7edf79a7' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- SAPジャパン株式会社
UPDATE public.ow_companies SET headquarters_address='東京都港区六本木6-10-1 六本木ヒルズ'
 WHERE id='dcd2c652-4335-4031-b4d2-a4f22c98182b' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- アップルジャパン合同会社
UPDATE public.ow_companies SET headquarters_address='東京都港区赤坂9-7-1 ミッドタウン・タワー'
 WHERE id='27988ac1-fd93-445d-a9fd-6dad74c92686' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- シスコシステムズ合同会社
UPDATE public.ow_companies SET headquarters_address='東京都千代田区丸の内1-4-1 丸の内永楽ビルディング25階'
 WHERE id='ec97fde1-6f22-4ab5-89ee-9cea0b258f2a' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- インテル株式会社
UPDATE public.ow_companies SET headquarters_address='東京都港区六本木1-9-10'
 WHERE id='943620b5-0fa2-48b4-a072-d47f900ba9f0' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');  -- ウーバー・ジャパン株式会社
DO $$
DECLARE v_filled int; v_target int; v_bad int; v_total int;
BEGIN
  SELECT count(*) INTO v_filled FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_filled <> 73 THEN RAISE EXCEPTION '住所ありが % 社（53+20=73 のはず）。中止', v_filled; END IF;
  SELECT count(*) INTO v_target FROM public.ow_companies
   WHERE id IN ('9ccf1640-6a5c-42e3-bbcf-4110f715fbf4','1241f8a5-b645-4aa2-9fa1-bbfc573f1774','4fecbf31-498c-40b0-a04e-3a6cb978433f','e459ac79-5dad-499d-bb65-b758d4281123','1413b97e-ef19-4e40-87ae-e31ac8996bdd','3efd857e-315c-4650-9727-1e5aa1245753','f32e6905-f25f-4c01-b64f-c5695fd45a1d','53ea9a54-feef-413b-8a7c-e31e4def2e11','e3eafa66-02ce-4060-a5fe-57e4317c8e7c','08e4aff6-a12c-4963-ad43-960ac9e39967','0a216ebb-c1fa-4d19-b066-f45e45c3ba2e','99132c64-ff07-4945-aeb6-7e21e6c256c9','7dac3c6e-bc5f-4550-9170-4338ea809be2','b8aa0e3d-828c-4bbe-b588-88450aab5739','355ce5c6-0412-4512-8864-1d477c97c917','bcea5e4e-94ee-4019-8ce3-237a7edf79a7','dcd2c652-4335-4031-b4d2-a4f22c98182b','27988ac1-fd93-445d-a9fd-6dad74c92686','ec97fde1-6f22-4ab5-89ee-9cea0b258f2a','943620b5-0fa2-48b4-a072-d47f900ba9f0')
     AND headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_target <> 20 THEN RAISE EXCEPTION '埋まったのが % 社（20 のはず）。中止', v_target; END IF;

  /* ⚠️ `丁目` は建物名にも入る（Databricks の「日本橋三丁目スクエア」、
        今回の KnowBe4 も同じビル）。弾くのは**数字の直後**だけ。 */
  SELECT count(*) INTO v_bad FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> ''
     AND (headquarters_address LIKE '%〒%' OR headquarters_address ~ '[０-９]'
          OR headquarters_address ~ '[0-9]丁目'
          OR headquarters_address !~ '^(北海道|東京都|大阪府|京都府|.{2,3}県)');
  IF v_bad <> 0 THEN RAISE EXCEPTION '書式が想定と違う行が % 件。中止', v_bad; END IF;

  SELECT count(*) INTO v_total FROM public.ow_companies;
  IF v_total <> 89 THEN RAISE EXCEPTION 'ow_companies が % 行（89 のはず）。中止', v_total; END IF;
  RAISE NOTICE '完了: 住所あり % 社（+20）/ 書式違反 % 件', v_filled, v_bad;
END $$;

COMMIT;
