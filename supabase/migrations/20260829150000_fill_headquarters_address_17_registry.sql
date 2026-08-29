-- ═══════════════════════════════════════════════════════════════════════════
-- 本社住所を17社に入れる（2026-08-29 / 第4バッチ）
-- ★★出所が今までと違う ── **国税庁 法人番号公表サイト（登記上の本店所在地）**
--
-- ── なぜ出所を変えたか ──────────────────────────────────────────────────────
-- 残っていた48社は**ほぼ全部が外資系日本法人**で、日本語サイトはあっても
-- **日本法人の住所が載っていない**（Zendesk・インテル・Microsoft で確認）。
-- 企業サイトを1社ずつ当たる方式はここで行き詰まった。
--
-- → 国税庁の法人番号公表サイト（https://www.houjin-bangou.nta.go.jp/）で照会した。
--    公的な登記情報なので、載っていない・bot に弾かれる、が起きない。
--
-- ── ⚠️★★既存31社と「意味」が違う。混ぜていることを忘れないこと ──────────────
-- | | 出所 | 意味 |
-- |---|---|---|
-- | 既存31社（`20260828150000` `20260829130000` `20260829140000`） | 各社の公式サイト | **オフィス所在地**（人がいる場所） |
-- | **この17社** | **国税庁** | **登記上の本店所在地** |
--
-- 多くは一致するが、**外資系では登記が実オフィスと違うことがある**
-- （設立時の住所のまま／法務事務所の住所など）。
-- ⚠️ 柴さんの判断で (a)「登記で埋める」を採った。求職者にとって住所は
--    「どのあたりの会社か」の手がかりで、差があっても害が小さいという理由。
-- ⚠️ **企業から訂正が来たら、そちらを優先する。**
-- ⚠️ 出所を列で持つ仕組み（`source_urls`）は未実装。docs/todo.md の設計案を参照。
--    **実装したら、この17社を「登記由来」として記録すること。**
--
-- ── ⚠️★入れなかった6社（誤ヒット・複数ヒット）────────────────────────────────
-- | 企業 | 理由 |
-- |---|---|
-- | **Box Japan** | **無関係な企業しかヒットしない**（Sandbox VR Japan / Chatterbox Japan）。部分一致の弊害 |
-- | SAPジャパン | **同名2社**（大手町のエスエイピージャパン／台東区のサップジャパン） |
-- | シスコシステムズ | 赤坂のほかに**練馬区のマンションに同名法人** |
-- | ブラックライン | 赤坂のほかに**愛知県の同名法人** |
-- | インテル | 神田三崎町。一般に知られる日本法人と違う可能性 |
-- | コング・ジャパン | 登記名は「コングジャパン株式会社」（中黒なし）。同一法人か未確認 |
--
-- ⚠️★**Box Japan は3件目の誤検出。** 前例は DocuSign の電話番号（2026-08-28）と
--    富士フイルムのプレスリリース定型文（`20260829140000`）。
--    **この列を機械で埋める仕組みを作らないこと。必ず人が結果を読む。**
--
-- ── 書式 ───────────────────────────────────────────────────────────────────
-- 登記は全角・「N丁目M番K号」形式。既存25社に合わせて
-- **〒なし / 半角ハイフン / 建物名を続ける**に直した（例: 港南２丁目１６番３号 → 港南2-16-3）。
-- ⚠️ エヌビディアの登記は「ＡＴＴＥＡＳＴ」。建物名は "ATT EAST" なので空白を入れた。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260829-2256-ow_companies.sql（スキーマ+データ / 89行）
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_filled int; v_target int;
BEGIN
  SELECT count(*) INTO v_filled FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_filled <> 31 THEN RAISE EXCEPTION '住所ありが % 社（31 のはず）。中止', v_filled; END IF;

  SELECT count(*) INTO v_target FROM public.ow_companies
   WHERE id IN ('40dca29e-aa4b-4654-aada-8e29763f8521','1f8010f2-ba3f-4f7a-b7f4-d5b60400e638',
                '7d186c45-ce23-4d96-8eae-cd6e7c00faee','a9de1561-eb91-4ebf-842d-f6d39865b7ef',
                'eccd3dfb-decd-4277-a3a4-df489d3b3e5e','cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16',
                '4df6e844-74d6-4f50-98f9-08468a12f1dc','bf24736f-fa65-4c5a-9764-98c96ace3b07',
                '1f73df31-8e55-4e70-a928-afe1150d72d0','565b0f13-252d-44d0-8b90-e00acacf4b75',
                '6396920c-70d3-47d2-9f4e-67bc2efe262f','fc1f7cb7-9530-4d6a-85cf-15196a4b155e',
                '829a1ea9-d577-4404-9ba7-e301680523a8','94edfbe5-0496-4c1d-865c-d2d448232135',
                'f201ed17-a9e2-4859-85aa-474578b2870d','b8b7a2d4-20a8-4fe1-8651-61a6503f762e',
                'c32027b9-cfbd-4a70-bf4c-464e42790db4')
     AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');
  IF v_target <> 17 THEN RAISE EXCEPTION '空の対象が % 社（17 のはず）。中止', v_target; END IF;
  RAISE NOTICE '適用前: 住所あり % 社', v_filled;
END $$;

UPDATE public.ow_companies SET headquarters_address='東京都港区港南2-16-3 品川グランドセントラルタワー'
 WHERE id='40dca29e-aa4b-4654-aada-8e29763f8521' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都港区北青山2-5-8'
 WHERE id='1f8010f2-ba3f-4f7a-b7f4-d5b60400e638' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都渋谷区渋谷3-21-3 渋谷ストリーム'
 WHERE id='7d186c45-ce23-4d96-8eae-cd6e7c00faee' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都港区麻布台1-3-1'
 WHERE id='a9de1561-eb91-4ebf-842d-f6d39865b7ef' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都品川区大崎1-11-2 ゲートシティ大崎イーストタワー'
 WHERE id='eccd3dfb-decd-4277-a3a4-df489d3b3e5e' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都千代田区大手町1-1-1 大手町パークビルディング'
 WHERE id='cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都千代田区有楽町1-1-2 日比谷三井タワー'
 WHERE id='4df6e844-74d6-4f50-98f9-08468a12f1dc' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都渋谷区道玄坂1-10-8 渋谷道玄坂東急ビル2F-C'
 WHERE id='bf24736f-fa65-4c5a-9764-98c96ace3b07' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都千代田区丸の内2-7-2'
 WHERE id='1f73df31-8e55-4e70-a928-afe1150d72d0' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都港区白金台3-10-10'
 WHERE id='565b0f13-252d-44d0-8b90-e00acacf4b75' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都中央区八重洲2-2-1 東京ミッドタウン八重洲 八重洲セントラルタワー'
 WHERE id='6396920c-70d3-47d2-9f4e-67bc2efe262f' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
/* ⚠️ 神奈川県。東京と取り違えないこと */
UPDATE public.ow_companies SET headquarters_address='神奈川県横浜市西区みなとみらい2-2-1 横浜ランドマークタワー14階'
 WHERE id='fc1f7cb7-9530-4d6a-85cf-15196a4b155e' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都港区赤坂2-11-7 ATT EAST 13階'
 WHERE id='829a1ea9-d577-4404-9ba7-e301680523a8' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都港区南青山1-1-1'
 WHERE id='94edfbe5-0496-4c1d-865c-d2d448232135' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都千代田区外神田4-14-1 秋葉原UDX'
 WHERE id='f201ed17-a9e2-4859-85aa-474578b2870d' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都江東区豊洲2-2-1'
 WHERE id='b8b7a2d4-20a8-4fe1-8651-61a6503f762e' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');
UPDATE public.ow_companies SET headquarters_address='東京都江東区大島2-2-1'
 WHERE id='c32027b9-cfbd-4a70-bf4c-464e42790db4' AND (headquarters_address IS NULL OR btrim(headquarters_address)='');

DO $$
DECLARE v_filled int; v_target int; v_bad int; v_total int;
BEGIN
  SELECT count(*) INTO v_filled FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_filled <> 48 THEN RAISE EXCEPTION '住所ありが % 社（31+17=48 のはず）。中止', v_filled; END IF;

  SELECT count(*) INTO v_target FROM public.ow_companies
   WHERE id IN ('40dca29e-aa4b-4654-aada-8e29763f8521','1f8010f2-ba3f-4f7a-b7f4-d5b60400e638',
                '7d186c45-ce23-4d96-8eae-cd6e7c00faee','a9de1561-eb91-4ebf-842d-f6d39865b7ef',
                'eccd3dfb-decd-4277-a3a4-df489d3b3e5e','cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16',
                '4df6e844-74d6-4f50-98f9-08468a12f1dc','bf24736f-fa65-4c5a-9764-98c96ace3b07',
                '1f73df31-8e55-4e70-a928-afe1150d72d0','565b0f13-252d-44d0-8b90-e00acacf4b75',
                '6396920c-70d3-47d2-9f4e-67bc2efe262f','fc1f7cb7-9530-4d6a-85cf-15196a4b155e',
                '829a1ea9-d577-4404-9ba7-e301680523a8','94edfbe5-0496-4c1d-865c-d2d448232135',
                'f201ed17-a9e2-4859-85aa-474578b2870d','b8b7a2d4-20a8-4fe1-8651-61a6503f762e',
                'c32027b9-cfbd-4a70-bf4c-464e42790db4')
     AND headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_target <> 17 THEN RAISE EXCEPTION '埋まったのが % 社（17 のはず）。中止', v_target; END IF;

  /* ★書式: 〒なし・都道府県で始まる・全角数字が残っていない
     ⚠️★`丁目` を単純に禁止しない。**建物名に入ることがある。**
        実測（2026-08-29）: Databricks Japan の
        「東京都中央区日本橋3-9-1 **日本橋三丁目スクエア**11F」で、
        最初この検査に引っかかって migration が中止した（アサートが正しく止めた）。
        番地の「N丁目M番」だけを弾く —— **数字の直後の「丁目」**に限定する。 */
  SELECT count(*) INTO v_bad FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> ''
     AND (headquarters_address LIKE '%〒%'
          OR headquarters_address ~ '[０-９]'
          OR headquarters_address ~ '[0-9]丁目'
          OR headquarters_address !~ '^(北海道|東京都|大阪府|京都府|.{2,3}県)');
  IF v_bad <> 0 THEN RAISE EXCEPTION '書式が想定と違う行が % 件。中止', v_bad; END IF;

  SELECT count(*) INTO v_total FROM public.ow_companies;
  IF v_total <> 89 THEN RAISE EXCEPTION 'ow_companies が % 行（89 のはず）。中止', v_total; END IF;
  RAISE NOTICE '完了: 住所あり % 社（+17）/ 書式違反 % 件', v_filled, v_bad;
END $$;

COMMIT;
