-- ═══════════════════════════════════════════════════════════════════════════
-- ★Databricks Japan の本社住所が誤っていたので直す（2026-08-30）
--
-- ── 何が起きていたか ────────────────────────────────────────────────────────
-- 出典URLを埋める作業で公式サイトを開いたところ、**登録していた住所と違っていた。**
--
-- | | |
-- |---|---|
-- | 本番（誤） | `東京都中央区日本橋3-9-1 日本橋三丁目スクエア11F` |
-- | 公式（正） | `〒100-6528 東京都千代田区丸の内一丁目5番1号 新丸の内ビルディング28階` |
--
-- **区が違う**（中央区 → 千代田区）。移転か当初からの誤りかは分からない。
-- 出典: `https://www.databricks.com/jp/company/contact/office-locations` の「東京（日本）」。
--
-- ⚠️ 投入元は `20260813061500_fill_company_profile_9_companies.sql`（2026-08-13）で、
--    当時から**出典URLが残っていなかった**。だから今日まで誰も突き合わせられなかった。
--    **出典を記録する仕組みを入れた当日に、1件目の誤りが出た**ということ。
--
-- ── 書式は既存73件に合わせる ────────────────────────────────────────────────
-- **〒は付けない / 番地は半角ハイフン / 建物名を続ける**
-- （実測 2026-08-30: 郵便番号を含む行は **0/73**）。
-- 出典の「丸の内一丁目5番1号」→ `丸の内1-5-1`。
-- 階は出典どおり **「28階」**（実測: 「階」23件 / 「F」17件。**どちらもあるので出典に従う**）。
--
-- ── ⚠️ 同時に出典も記録する ────────────────────────────────────────────────
-- 住所だけ直して出典を空のままにすると、**次に見る人がまた突き合わせられない。**
-- `source_url` と `verified_at` をこの migration で一緒に入れる。
--
-- ── ⚠️ 他の8社は触らない ────────────────────────────────────────────────────
-- `20260813061500` は9社を一括で埋めているが、**今回照合したのは Databricks だけではない**
-- ——同バッチの Datadog / HubSpot / OpenAI / Sansan / Ubie / SmartHR / PKSHA / 日本HP も
-- 公式サイトで断片一致を確認しており、**食い違ったのは Databricks のみ**だった。
-- ⚠️ ただし確認したのは**建物名または番地の断片**であって全文照合ではない。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260830-1929-ow_companies-ow_company_data_sources.sql
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_addr text; v_url text;
BEGIN
  SELECT headquarters_address INTO v_addr FROM public.ow_companies WHERE slug = 'databricks';
  IF v_addr IS DISTINCT FROM '東京都中央区日本橋3-9-1 日本橋三丁目スクエア11F' THEN
    RAISE EXCEPTION '住所が想定と違う（%）。適用済みか前提が違う。中止', v_addr;
  END IF;

  SELECT s.source_url INTO v_url FROM public.ow_company_data_sources s
    JOIN public.ow_companies c ON c.id = s.company_id
   WHERE c.slug = 'databricks' AND s.field = 'headquarters_address';
  IF v_url IS NOT NULL THEN RAISE EXCEPTION 'Databricks に既に出典URLがある（%）。中止', v_url; END IF;

  RAISE NOTICE '適用前: %', v_addr;
END $$;

/* ⚠️ 対象は slug で明示し、現在値まで確認してから書き換える。 */
UPDATE public.ow_companies
   SET headquarters_address = '東京都千代田区丸の内1-5-1 新丸の内ビルディング28階',
       updated_at = now()
 WHERE slug = 'databricks'
   AND headquarters_address = '東京都中央区日本橋3-9-1 日本橋三丁目スクエア11F';

UPDATE public.ow_company_data_sources s SET
  source_url  = 'https://www.databricks.com/jp/company/contact/office-locations',
  verified_at = timestamptz '2026-08-30',
  note = coalesce(s.note || ' ／ ', '')
       || '2026-08-30 に公式サイトと突き合わせ、住所の誤りを訂正した'
       || '（中央区日本橋3-9-1 日本橋三丁目スクエア11F → 千代田区丸の内1-5-1 新丸の内ビルディング28階）。',
  updated_at = now()
WHERE s.company_id = (SELECT id FROM public.ow_companies WHERE slug = 'databricks')
  AND s.field = 'headquarters_address';

DO $$
DECLARE v_addr text; v_url text; v_null int; v_total int; v_ken int;
BEGIN
  SELECT headquarters_address INTO v_addr FROM public.ow_companies WHERE slug = 'databricks';
  IF v_addr <> '東京都千代田区丸の内1-5-1 新丸の内ビルディング28階' THEN
    RAISE EXCEPTION '住所が想定どおりに入っていない（%）。中止', v_addr;
  END IF;

  SELECT s.source_url INTO v_url FROM public.ow_company_data_sources s
    JOIN public.ow_companies c ON c.id = s.company_id
   WHERE c.slug = 'databricks' AND s.field = 'headquarters_address';
  IF v_url IS NULL THEN RAISE EXCEPTION 'Databricks の出典URLが入っていない。中止'; END IF;

  -- ★書式が既存に揃っていること（〒を持ち込んでいない）
  SELECT count(*) INTO v_ken FROM public.ow_companies
   WHERE headquarters_address LIKE '%〒%';
  IF v_ken <> 0 THEN RAISE EXCEPTION '〒 を含む住所が % 件。書式が崩れた。中止', v_ken; END IF;

  -- ★残る URL 未記録は OpenAI の1社だけ
  SELECT count(*) INTO v_null FROM public.ow_company_data_sources
   WHERE source_kind = 'official_site' AND source_url IS NULL;
  IF v_null <> 1 THEN RAISE EXCEPTION 'URL未記録が % 行（1 のはず）。中止', v_null; END IF;

  SELECT count(*) INTO v_total FROM public.ow_company_data_sources;
  IF v_total <> 73 THEN RAISE EXCEPTION '合計 % 行（73 のはず）。中止', v_total; END IF;

  RAISE NOTICE '完了: % / URL未記録は残り %（OpenAI のみ）', v_addr, v_null;
END $$;

COMMIT;
