-- ═══════════════════════════════════════════════════════════════════════════
-- 本社住所を6社に入れる（2026-08-29 / 第3バッチ・外資系日本法人）
--
-- ── どう取ったか ────────────────────────────────────────────────────────────
-- 残り54社に対して、探索先を広げた抽出器（`extract2`）を当てた。
-- 第1版から変えたのは3点:
--   ① リンクの語を増やす（所在地/アクセス/拠点/オフィス/お問い合わせ/Contact/Location）
--   ② **よくあるパスを直接叩く**（/company /about-us /jp/company /ja-jp/about …）
--   ③ 2階層まで辿る
-- ⚠️ **判定条件は変えていない。** ラベルの直後にある日本の住所の形だけを採る。
--
-- 結果: **54社中7社**で候補。**うち1社は誤検出**だったので除外し、6社を入れる。
--
-- ── ⚠️★誤検出が1件出た（富士フイルムビジネスイノベーションジャパン）──────────
-- 抽出器がプレスリリースの定型文を住所として拾った:
--
--   「東京都港区、代表取締役社長：浜 直樹）は、2025年7月アジア・パシフィック地域…」
--
-- **「本社」というラベルの直後にあったので条件は通ったが、住所ではない。**
-- 2026-08-28 の DocuSign の電話番号（588-5476）と同じ形で、
-- **機械的な抽出だけでは防げない。原文を1件ずつ読んで弾いた。**
-- ⚠️ この列を機械で埋める仕組みを作らないこと。**必ず人が原文を見る。**
--
-- ── ⚠️ 6社とも「本社」ではなく「東京オフィス」表記 ─────────────────────────
-- 外資系日本法人はこの形が大半だった（`20260829130000` のゼットスケーラーと同じ性質）。
-- **登記上の本店と一致する保証はない。** 企業から訂正が来たら、その行を優先して直す。
--
-- ⚠️ 支社は入れていない。オクタの大阪、セールスフォースの名古屋・白浜、
--    ワークデイの大阪は、同じページに載っていたが除外した。
--
-- ── 書式（既存25社に合わせた）──────────────────────────────────────────────
-- **〒 は付けない / 番地は半角ハイフン / 建物名を続ける**
-- デルの出典は「大手町一丁目2番1号」→ `1-2-1` に直した。
-- Zendesk の出典は「京橋 2-2-1」（空白入り）→ 詰めた。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260829-2130-ow_companies.sql（スキーマ+データ / 89行）
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_filled int; v_target int;
BEGIN
  SELECT count(*) INTO v_filled FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_filled <> 25 THEN RAISE EXCEPTION '住所ありが % 社（25 のはず）。中止', v_filled; END IF;

  SELECT count(*) INTO v_target FROM public.ow_companies
   WHERE id IN ('c3664ef1-5571-4645-b30f-1474e7961c17','f4acddc0-c746-4537-9edf-6f3c1f2c90b3',
                'f8ebbe74-b647-46ea-869f-b126d1c4f316','1027a327-18c0-4191-b27b-a28bf5781126',
                '8dc04d46-3430-45de-91f8-e37c8880b8a5','d6650b18-5ef2-40c9-9938-2adbad70fe2b')
     AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');
  IF v_target <> 6 THEN RAISE EXCEPTION '空の対象が % 社（6 のはず）。中止', v_target; END IF;
  RAISE NOTICE '適用前: 住所あり % 社', v_filled;
END $$;

/* ⚠️ 対象は id で明示列挙し、「まだ空」を条件に入れる（既存値を上書きしない） */
UPDATE public.ow_companies SET headquarters_address = '東京都千代田区丸の内1-1-3 日本生命丸の内ガーデンタワー'
 WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17' AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');

UPDATE public.ow_companies SET headquarters_address = '東京都千代田区大手町1-2-1 Otemachi Oneタワー 17階'
 WHERE id = 'f4acddc0-c746-4537-9edf-6f3c1f2c90b3' AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');

UPDATE public.ow_companies SET headquarters_address = '東京都渋谷区渋谷2-21-1 渋谷ヒカリエ30F'
 WHERE id = 'f8ebbe74-b647-46ea-869f-b126d1c4f316' AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');

UPDATE public.ow_companies SET headquarters_address = '東京都港区赤坂9-7-1 ミッドタウン・タワー18階'
 WHERE id = '1027a327-18c0-4191-b27b-a28bf5781126' AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');

UPDATE public.ow_companies SET headquarters_address = '東京都港区六本木6-10-1 六本木ヒルズ森タワー20F'
 WHERE id = '8dc04d46-3430-45de-91f8-e37c8880b8a5' AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');

UPDATE public.ow_companies SET headquarters_address = '東京都中央区京橋2-2-1 京橋エドグラン'
 WHERE id = 'd6650b18-5ef2-40c9-9938-2adbad70fe2b' AND (headquarters_address IS NULL OR btrim(headquarters_address) = '');

DO $$
DECLARE v_filled int; v_target int; v_bad int; v_total int;
BEGIN
  SELECT count(*) INTO v_filled FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_filled <> 31 THEN RAISE EXCEPTION '住所ありが % 社（25+6=31 のはず）。中止', v_filled; END IF;

  SELECT count(*) INTO v_target FROM public.ow_companies
   WHERE id IN ('c3664ef1-5571-4645-b30f-1474e7961c17','f4acddc0-c746-4537-9edf-6f3c1f2c90b3',
                'f8ebbe74-b647-46ea-869f-b126d1c4f316','1027a327-18c0-4191-b27b-a28bf5781126',
                '8dc04d46-3430-45de-91f8-e37c8880b8a5','d6650b18-5ef2-40c9-9938-2adbad70fe2b')
     AND headquarters_address IS NOT NULL AND btrim(headquarters_address) <> '';
  IF v_target <> 6 THEN RAISE EXCEPTION '埋まったのが % 社（6 のはず）。中止', v_target; END IF;

  /* ★書式: 〒 が混ざらない・都道府県で始まる */
  SELECT count(*) INTO v_bad FROM public.ow_companies
   WHERE headquarters_address IS NOT NULL AND btrim(headquarters_address) <> ''
     AND (headquarters_address LIKE '%〒%'
          OR headquarters_address !~ '^(北海道|東京都|大阪府|京都府|.{2,3}県)');
  IF v_bad <> 0 THEN RAISE EXCEPTION '書式が想定と違う行が % 件。中止', v_bad; END IF;

  SELECT count(*) INTO v_total FROM public.ow_companies;
  IF v_total <> 89 THEN RAISE EXCEPTION 'ow_companies が % 行（89 のはず）。中止', v_total; END IF;
  RAISE NOTICE '完了: 住所あり % 社（+6）/ 書式違反 % 件', v_filled, v_bad;
END $$;

COMMIT;
