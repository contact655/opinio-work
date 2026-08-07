-- ═══════════════════════════════════════════════════════════════════════════
-- ow_profiles に transfer_timing_updated_at を追加する
--
-- ── なぜ（2026-08-07）──────────────────────────────────────────────────────
-- 転職検討時期は「半年以内」と書いてあっても、それが**いつ時点の話か**が分からないと
-- 企業側は使えない。既存の ow_profiles.updated_at は
-- career-preferences API が**どの項目を保存しても**打ち直すため使えない
-- （希望年収を直しただけで「転職時期を今日更新した」ことになる）。
-- scout-settings API も同じ列を打つ。専用の列を持たせる。
--
-- ⚠️ 既存行はすべて NULL のままにする。
--    現在 transfer_timing が入っているのは2件だが、いつ入力されたかは分からない。
--    created_at や updated_at で埋めるのは推測になる（CLAUDE.md「データ表示の原則」）。
--    NULL は「更新日が不明」であり、表示側は鮮度バッジごと出さないこと。
--
-- ⚠️ 更新するのは API 側（transfer_timing が**実際に変わったとき**だけ）。
--    トリガーにはしない。同じ値を選び直しただけで新しくしてしまうため。
--
-- ⚠️ 列の GRANT は表レベルのまま（ow_profiles は列単位 GRANT に寄せていない）。
--    RLS は本人 own_read / own_update と admin_read の3本で、追加は不要。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_rows int; v_timing int;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='ow_profiles'
                AND column_name='transfer_timing_updated_at') THEN
    RAISE EXCEPTION 'transfer_timing_updated_at が既にある。中止';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='ow_profiles'
                    AND column_name='transfer_timing') THEN
    RAISE EXCEPTION 'transfer_timing が無い。想定が違う。中止';
  END IF;

  SELECT count(*), count(transfer_timing) INTO v_rows, v_timing FROM public.ow_profiles;
  RAISE NOTICE '適用前: ow_profiles % 件（transfer_timing 入力済 % 件）', v_rows, v_timing;
END $$;

ALTER TABLE public.ow_profiles ADD COLUMN transfer_timing_updated_at timestamptz;

COMMENT ON COLUMN public.ow_profiles.transfer_timing_updated_at IS
  'transfer_timing を最後に「変更」した日時。同じ値を選び直したときは更新しない。'
  ' NULL は「更新日が不明」。表示側は鮮度を推測せず、バッジごと出さないこと。'
  ' ⚠️ ow_profiles.updated_at は他の項目の保存でも打ち直されるため代用にならない。';

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_rows int; v_timing int; v_notnull int; v_cols int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='ow_profiles'
                    AND column_name='transfer_timing_updated_at'
                    AND data_type='timestamp with time zone' AND is_nullable='YES') THEN
    RAISE EXCEPTION '列が想定の型・NULL可で作られていない。ロールバック';
  END IF;

  -- 既存行を埋めていないこと
  SELECT count(*) INTO v_notnull FROM public.ow_profiles WHERE transfer_timing_updated_at IS NOT NULL;
  IF v_notnull <> 0 THEN RAISE EXCEPTION '既存行に値が入っている（% 件）。ロールバック', v_notnull; END IF;

  -- 他の列を触っていないこと
  SELECT count(*), count(transfer_timing) INTO v_rows, v_timing FROM public.ow_profiles;
  IF v_rows <> 39 THEN RAISE EXCEPTION 'ow_profiles が % 件（想定39）。ロールバック', v_rows; END IF;
  IF v_timing <> 2 THEN RAISE EXCEPTION 'transfer_timing が % 件（想定2）。ロールバック', v_timing; END IF;

  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_profiles';
  IF v_cols <> 22 THEN RAISE EXCEPTION '列数が %（想定22）。ロールバック', v_cols; END IF;

  RAISE NOTICE '完了: transfer_timing_updated_at を追加。既存 % 件はすべて NULL', v_rows;
END $$;

COMMIT;
