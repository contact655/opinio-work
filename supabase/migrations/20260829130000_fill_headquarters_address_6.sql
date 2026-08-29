-- ═══════════════════════════════════════════════════════════════════════════
-- 本社住所を6社に入れる（2026-08-29 / 第2バッチ）
--
-- ── どう取ったか ────────────────────────────────────────────────────────────
-- 日本語の会社概要がありそうな**10社**を選び、**実ブラウザで公式サイトを開いて**
-- 「所在地／本社」ラベルの直後にある日本の住所だけを拾った。**10社中6社**で取れた。
--
-- ⚠️★2026-08-28 の自動抽出（curl / 67社中7社＝約10%）とは方法が違う。
--    curl は多くのサイトが 403/406 で弾き、SPA では本文が取れない。
--    実ブラウザに変えたことと、**ラベルの直後だけを見る**条件にしたことで 60% になった。
--    ⚠️ **電話番号の誤検出は0件**（前回は DocuSign の「588-5476」を住所として拾っていた）。
--
-- ⚠️ **残り54社に 60% がそのまま続くとは考えないこと。** 今回の10社は
--    日本語サイトを持つ企業を選んで当てた。残りは外資系日本法人が中心で、
--    Zendesk・インテルのように「日本語ページはあるが住所が無い」型が多い。
--
-- ── 書式（既存19社に合わせた）──────────────────────────────────────────────
-- **〒 は付けない / 番地は半角ハイフン / 建物名を続ける**
-- 出典が「丸の内二丁目7番2号」でも `2-7-2` に直す。
--
-- ── 6社と出典 ──────────────────────────────────────────────────────────────
-- | 企業 | ラベル | 出典 |
-- |---|---|---|
-- | Opinio         | 所在地       | opinio.co.jp/company |
-- | シンカ          | **【本社】**  | thinca.co.jp/about/outline/ |
-- | タイミー         | **東京本社**  | corp.timee.co.jp/about/outline/ |
-- | Translead      | 所在地・**本社** | translead.jp/company |
-- | irodas         | **大阪本社**  | irodas.com/corporate/company |
-- | ゼットスケーラー    | 「東京」オフィス | zscaler.com/jp/company/contact |
--
-- ⚠️★**irodas は大阪本社**。東京ではない（東京にも支社があるが、本社は大阪）。
-- ⚠️★**ゼットスケーラーだけ性質が違う。** 他5社は「本社」と明記されていたが、
--    これは**オフィス所在地**の記載で、登記上の本店と一致する保証がない。
--    ⚠️ 企業から訂正が来たら、この行を優先して直すこと。
--
-- ⚠️ 支社は入れていない。シンカの大阪・京都、タイミーの札幌〜福岡7支社は本社と
--    区別して除外した。**`branch_locations` に足すかは別の判断。**
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260829-2110-ow_companies.sql（スキーマ+データ / 89行）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_filled int; v_target int; v_total int;
BEGIN
  SELECT count(*) INTO v_filled FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_filled <> 19 THEN
    RAISE EXCEPTION '住所ありが % 社（19 のはず）。前提が違う。中止', v_filled;
  END IF;

  -- ★対象6社が「まだ空」であること（二重適用を成功に見せない）
  SELECT count(*) INTO v_target FROM public.ow_companies
   WHERE id IN ('cf44d740-b835-454d-91a3-f1e2eddc7251',
                '28b826eb-fb86-4124-aa08-c489cad662f1',
                '2e54ff06-2f4d-420c-9a5c-9a80a85ca55a',
                'd1c26664-5643-42bc-84e4-6f0c940bb39d',
                '63d390da-e8c4-464a-8c30-e112fcd2709c',
                'dd76b17d-e3c1-44a9-b747-4ecde10b8cec')
     AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');
  IF v_target <> 6 THEN
    RAISE EXCEPTION '空の対象が % 社（6 のはず）。中止', v_target;
  END IF;

  SELECT count(*) INTO v_total FROM public.ow_companies;
  RAISE NOTICE '適用前: 住所あり % 社 / 全 % 行', v_filled, v_total;
END $$;

/* ⚠️ 対象は id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
      さらに「まだ空」であることを条件に入れ、既存の値を上書きしない。 */
UPDATE public.ow_companies SET headquarters_address = '東京都港区赤坂2-21-4 天翔赤坂ANNEXビル 404-C'
 WHERE id = 'cf44d740-b835-454d-91a3-f1e2eddc7251' AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');

UPDATE public.ow_companies SET headquarters_address = '東京都千代田区神田錦町3-17 廣瀬ビル10F'
 WHERE id = '28b826eb-fb86-4124-aa08-c489cad662f1' AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');

UPDATE public.ow_companies SET headquarters_address = '東京都港区東新橋1-5-2 汐留シティセンター 35階'
 WHERE id = '2e54ff06-2f4d-420c-9a5c-9a80a85ca55a' AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');

UPDATE public.ow_companies SET headquarters_address = '東京都港区六本木7-15-9 住友不動産六本木セントラルタワー 9F'
 WHERE id = 'd1c26664-5643-42bc-84e4-6f0c940bb39d' AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');

/* ⚠️ 大阪本社。東京と取り違えないこと */
UPDATE public.ow_companies SET headquarters_address = '大阪府大阪市北区豊崎3-19-3 ピアスタワー12F'
 WHERE id = '63d390da-e8c4-464a-8c30-e112fcd2709c' AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');

/* ⚠️ オフィス所在地。「本社」と明記されていない唯一の行 */
UPDATE public.ow_companies SET headquarters_address = '東京都千代田区丸の内2-7-2 JPタワー 14階'
 WHERE id = 'dd76b17d-e3c1-44a9-b747-4ecde10b8cec' AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');

DO $$
DECLARE v_filled int; v_target int; v_total int; v_bad int;
BEGIN
  SELECT count(*) INTO v_filled FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_filled <> 25 THEN
    RAISE EXCEPTION '住所ありが % 社（19+6=25 のはず）。中止', v_filled;
  END IF;

  -- ★対象6社が全部埋まったこと
  SELECT count(*) INTO v_target FROM public.ow_companies
   WHERE id IN ('cf44d740-b835-454d-91a3-f1e2eddc7251','28b826eb-fb86-4124-aa08-c489cad662f1',
                '2e54ff06-2f4d-420c-9a5c-9a80a85ca55a','d1c26664-5643-42bc-84e4-6f0c940bb39d',
                '63d390da-e8c4-464a-8c30-e112fcd2709c','dd76b17d-e3c1-44a9-b747-4ecde10b8cec')
     AND headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_target <> 6 THEN RAISE EXCEPTION '埋まったのが % 社（6 のはず）。中止', v_target; END IF;

  /* ★書式の確認: 〒 が混ざっていないこと・都道府県で始まること */
  SELECT count(*) INTO v_bad FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> ''
     AND (headquarters_address LIKE '%〒%'
          OR headquarters_address !~ '^(北海道|東京都|大阪府|京都府|.{2,3}県)');
  IF v_bad <> 0 THEN RAISE EXCEPTION '書式が想定と違う行が % 件ある。中止', v_bad; END IF;

  SELECT count(*) INTO v_total FROM public.ow_companies;
  IF v_total <> 89 THEN RAISE EXCEPTION 'ow_companies が % 行（89 のはず）。中止', v_total; END IF;

  RAISE NOTICE '完了: 住所あり % 社（+6）/ 全 % 行 / 書式違反 % 件', v_filled, v_total, v_bad;
END $$;

COMMIT;
