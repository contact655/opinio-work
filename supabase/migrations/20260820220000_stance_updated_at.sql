-- ═══════════════════════════════════════════════════════════════════════════
-- ow_profiles.stance_updated_at を足す（2026-08-20）
--
-- 「声をかけられてもよいか」（＝ `scout_enabled`）を**最後に本人が決めた日時**。
-- 企業側が「3ヶ月以内に意思表示した人」で絞れるようにするための土台。
--
-- ── 既にある同じ形 ───────────────────────────────────────────────────────
--   `transfer_timing_updated_at`（2026-08-07）とまったく同じ作りにする。
--     ・**アプリ側**で「保存前の値と比べて実際に変わったときだけ」`now()` を入れる
--     ・同じ値を選び直しても更新しない
--     ・読みは `src/lib/profile/freshness.ts` の `describeFreshness()`
--   ⚠️ **trigger は作らない。** `ow_profiles` / `ow_users` には trigger が1本も無く、
--      ここで1本目を作ると「この表は trigger が無い」という前提が崩れる。
--
-- ⚠️ **遡って埋められない列。** いつ答えたかの記録が無いので、既存の人は NULL のまま。
--    `transfer_timing_updated_at` が0件のままなのが実例で、**早く入れるほど有利**。
--    NULL は「未更新」であって「古い」ではない（`describeFreshness` は null を返す）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.ow_profiles ADD COLUMN IF NOT EXISTS stance_updated_at timestamptz;

COMMENT ON COLUMN public.ow_profiles.stance_updated_at IS
  '「声をかけられてもよいか」（scout_enabled）を最後に変更した日時。'
  'アプリ側で、値が実際に変わったときだけ now() を入れる（trigger は無い）。'
  'NULL は「未更新」。遡って埋められないので推測で埋めないこと。';

DO $$
DECLARE v_ok boolean; v_trg int;
BEGIN
  SELECT count(*)=1 INTO v_ok FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_profiles' AND column_name='stance_updated_at';
  IF NOT v_ok THEN RAISE EXCEPTION '列が足されていない。中止'; END IF;

  -- ⚠️ この表に trigger を増やしていないこと
  SELECT count(*) INTO v_trg FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   WHERE c.relname='ow_profiles' AND NOT t.tgisinternal;
  IF v_trg <> 0 THEN RAISE EXCEPTION 'ow_profiles に trigger が % 本ある（想定0）。中止', v_trg; END IF;

  RAISE NOTICE '適用後: stance_updated_at を追加 / trigger は0本のまま';
END $$;

COMMIT;
