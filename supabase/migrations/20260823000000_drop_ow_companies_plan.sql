-- ============================================================================
-- ⚠️⚠️ **このファイルはまだ適用していない。** ⚠️⚠️
--
-- 拡張子が `.sql.pending` で、置き場所も `supabase/migrations/_pending/` なので
-- `supabase db push` の対象外。適用するときは
--   ① 下の「適用前にやること」を全部済ませる
--   ② `supabase/migrations/20260823000000_drop_ow_companies_plan.sql` へ移す
--   ③ `supabase db push`
--
-- ── 適用前にやること（必須）──────────────────────────────────────────────
-- ★ **列を落とすので data-only の保全では戻せない。**
--    `SUPABASE_DB_URL` を設定して、スキーマ＋データで保全すること。
--
--      export SUPABASE_DB_URL='...'      # リポジトリ内のファイルに書かない
--      ./scripts/dump-tables.sh ow_companies
--
--    出力は .dumps/YYYYMMDD-HHMM-ow_companies.sql（.gitignore 済み）。
--
-- ★ 読むコードが0件のままであることを、その時点で測り直すこと。
--
--      grep -rn "\.plan\b" src --include='*.ts' --include='*.tsx' | grep -v planType
--      grep -rn "ow_companies" src | grep -n "plan"
--
--    ⚠️ 0件を根拠にする前に、当たるはずの語で grep が動いていることを確かめる
--       （CLAUDE.md「grep が 0件のときは、検索が効いていることを先に確かめる」）。
--
-- ── なぜ落とすか ────────────────────────────────────────────────────────
-- `ow_companies.plan` は 2026-08-22 時点で **87社すべて 'free'** で、
-- **読んでいるコードが1つも無い**。プランの正は `ow_company_plans`。
-- 2箇所に持つと必ず食い違う。
--
-- ⚠️ ただし `ow_company_plans` にゲートを載せ替えた直後に落とすと、
--    切り戻しの余地が無くなる。**しばらく並走させてから落とす**ための保留。
--
-- ── 復元用 ──────────────────────────────────────────────────────────────
-- ALTER TABLE public.ow_companies ADD COLUMN plan text DEFAULT 'free';
-- UPDATE public.ow_companies SET plan = 'free';
-- ⚠️ `ow_companies` は **UPDATE が列単位** で配られている（テーブルレベルを
--    落としてある）。列を戻したら GRANT も戻すこと:
--      GRANT UPDATE (plan) ON public.ow_companies TO authenticated;
--    ⚠️ 現在 plan 列に UPDATE 権限が配られているかは、落とす前に測ること:
--      SELECT has_column_privilege('authenticated','public.ow_companies','plan','UPDATE');
-- ============================================================================

ALTER TABLE public.ow_companies DROP COLUMN IF EXISTS plan;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ow_companies' AND column_name = 'plan'
  ) THEN
    RAISE EXCEPTION 'ow_companies.plan が残っている';
  END IF;
END $$;
