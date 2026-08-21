-- ============================================================================
-- プランを Free / 有料 の2段にする
--
-- 2026-08-23 の決定。starter / growth / scale の3段を作ったが、
-- **有料プランが1つも実装・販売されないうちに2段へ整理し直した。**
-- 段を分ける根拠（機能差）が無いまま値だけ増やしていた。
--
--   free … 企業ページ・求人掲載・応募の受付（規約 /terms/listing 第4条1項）
--   paid … 上記 + 候補者検索 / 応募者の連絡先 / アンバサダー招待
--
-- ⚠️ **スカウト送信は有料プランに含めない。** `SCOUT_SENDING_ENABLED` で
--    停止中で、再開の判断もしていない。売れないものを機能表に書かない。
--
-- ── データ変換は不要 ────────────────────────────────────────────────────
-- 適用前の実測: 87行すべて plan_type='free' / status='active'。
-- starter / growth / scale の行は**一度も作られていない**（検証で一時的に
-- 作った行は都度削除している）。下の DO ブロックで再確認してから制約を張る。
--
-- ⚠️ `billing_cycle`（monthly / yearly）は**触らない**。列は残す。
--    UIも料金表も月額のみだが、年払いを入れるときに列から作り直さずに済む。
--
-- ── 復元用 ──────────────────────────────────────────────────────────────
-- ALTER TABLE public.ow_company_plans DROP CONSTRAINT ow_company_plans_plan_type_check;
-- ALTER TABLE public.ow_company_plans ADD CONSTRAINT ow_company_plans_plan_type_check
--   CHECK (plan_type IN ('free','starter','growth','scale'));
-- ============================================================================

-- ── ① 適用前の検算：free 以外が1行でもあれば止める ──────────────────────
DO $$
DECLARE
  v_total int;
  v_non_free int;
BEGIN
  SELECT count(*) INTO v_total    FROM public.ow_company_plans;
  SELECT count(*) INTO v_non_free FROM public.ow_company_plans WHERE plan_type <> 'free';

  RAISE NOTICE 'ow_company_plans %行 / free 以外 %行', v_total, v_non_free;

  IF v_non_free > 0 THEN
    RAISE EXCEPTION
      'free 以外の行が %行ある。2値化する前に変換方針を決めること（starter/growth/scale をどちらに寄せるか）',
      v_non_free;
  END IF;
END $$;

-- ── ② CHECK を2値に ────────────────────────────────────────────────────
-- ⚠️ UI / API / DB の3つを揃える（CLAUDE.md）。
--    アプリ側の正は `src/lib/constants/plans.ts` の `PLAN_TYPES`。
--    値を足すときは必ず両方直す。
ALTER TABLE public.ow_company_plans
  DROP CONSTRAINT IF EXISTS ow_company_plans_plan_type_check;

ALTER TABLE public.ow_company_plans
  ADD CONSTRAINT ow_company_plans_plan_type_check
  CHECK (plan_type IN ('free', 'paid'));

COMMENT ON COLUMN public.ow_company_plans.plan_type IS
  'free | paid の2値。2026-08-23 に starter/growth/scale の3段から整理した。'
  '有料プランの月額は src/lib/constants/plans.ts の PAID_PLAN_MONTHLY_FEE が正。';

-- ── ③ 適用後の検算 ──────────────────────────────────────────────────────
DO $$
DECLARE
  v_def text;
  v_active int;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'public.ow_company_plans'::regclass
     AND conname = 'ow_company_plans_plan_type_check';

  IF v_def IS NULL OR v_def NOT LIKE '%paid%' OR v_def LIKE '%starter%' THEN
    RAISE EXCEPTION 'CHECK が2値になっていない: %', coalesce(v_def, '(無し)');
  END IF;

  SELECT count(*) INTO v_active FROM public.ow_company_plans WHERE status = 'active';
  IF v_active <> (SELECT count(*) FROM public.ow_companies) THEN
    RAISE EXCEPTION 'active なプラン(%)と企業数(%)が一致しない',
      v_active, (SELECT count(*) FROM public.ow_companies);
  END IF;

  RAISE NOTICE 'CHECK: % / active %行', v_def, v_active;
END $$;
