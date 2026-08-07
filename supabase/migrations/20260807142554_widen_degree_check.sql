-- ═══════════════════════════════════════════════════════════════════════════
-- ow_user_educations.degree の CHECK に「小学校卒」「中学校卒」を足す
--
-- ── 背景 ────────────────────────────────────────────────────────────────────
-- 2026-05-30（セッション9）に「学歴 degree ドロップダウン拡充」として
-- API の許容値と UI の選択肢に 小学校卒 / 中学校卒 を追加したが、
-- **CHECK 制約を広げる migration が入っていなかった。**
--
-- 結果、この2つは選択肢として画面に出るのに保存できない状態だった:
--   API の 400 は通過する（許容値に入っているため）
--   → INSERT が 23514 で落ちる
--   → route が握って `{ error: "Internal server error" }` の 500 を返す
--   → 利用者には「保存に失敗しました」としか見えない
--
-- ⚠️ 「定数だけ直して CHECK を忘れた」形。記録上は完了に見えていた。
--    選択肢を増やすときは **UI / API / CHECK の3つ**を必ず揃えること。
--
-- ── 影響範囲 ────────────────────────────────────────────────────────────────
-- 値を増やすだけで、既存の値は1つも失わない。既存行は全件そのまま通る。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total  int;
  v_ng     int;
  v_new    int;
BEGIN
  SELECT count(*) INTO v_total FROM public.ow_user_educations;

  -- 既存行が **新しい** CHECK を全件通ることを確認する
  SELECT count(*) INTO v_ng FROM public.ow_user_educations
   WHERE degree IS NOT NULL
     AND degree <> ALL (ARRAY['小学校卒','中学校卒','高校卒','専門卒','短大卒','学士','修士','博士','その他']);
  IF v_ng > 0 THEN
    RAISE EXCEPTION '新しい CHECK を通らない既存行が % 件ある。中止', v_ng;
  END IF;

  -- 追加する2値が既に入っていないこと（入っていたら前提が崩れている）
  SELECT count(*) INTO v_new FROM public.ow_user_educations
   WHERE degree IN ('小学校卒','中学校卒');
  IF v_new > 0 THEN
    RAISE EXCEPTION '追加予定の2値が既に % 件入っている。CHECK の現状を確認すること', v_new;
  END IF;

  RAISE NOTICE '適用前: ow_user_educations % 件 / 新CHECKを通らない行 0 件', v_total;
END $$;

-- ── 本体 ────────────────────────────────────────────────────────────────────
ALTER TABLE public.ow_user_educations
  DROP CONSTRAINT IF EXISTS ow_user_educations_degree_check;

ALTER TABLE public.ow_user_educations
  ADD CONSTRAINT ow_user_educations_degree_check
  CHECK (degree = ANY (ARRAY[
    '小学校卒'::text, '中学校卒'::text, '高校卒'::text, '専門卒'::text,
    '短大卒'::text, '学士'::text, '修士'::text, '博士'::text, 'その他'::text
  ]));

COMMENT ON CONSTRAINT ow_user_educations_degree_check ON public.ow_user_educations IS
  '許容値は src/lib/constants/careerOptions.ts の DEGREES と一致させること（2026-08-07）';

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'public.ow_user_educations'::regclass
     AND conname  = 'ow_user_educations_degree_check';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'CHECK が張られていない。ロールバック';
  END IF;
  IF v_def NOT LIKE '%小学校卒%' OR v_def NOT LIKE '%中学校卒%' THEN
    RAISE EXCEPTION 'CHECK に2値が入っていない: %', v_def;
  END IF;
  -- 既存の7値が落ちていないこと
  IF v_def NOT LIKE '%高校卒%' OR v_def NOT LIKE '%専門卒%' OR v_def NOT LIKE '%短大卒%'
     OR v_def NOT LIKE '%学士%' OR v_def NOT LIKE '%修士%' OR v_def NOT LIKE '%博士%'
     OR v_def NOT LIKE '%その他%' THEN
    RAISE EXCEPTION '既存の値が CHECK から落ちている: %', v_def;
  END IF;

  RAISE NOTICE '完了: degree の CHECK は 9値になった';
END $$;

COMMIT;
