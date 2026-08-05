-- ═══════════════════════════════════════════════════════════════════════════
-- ow_job_applications.status に 'hired' を許可する
--
-- ── なぜ要るか（2026-08-05）────────────────────────────────────────────────
-- DB の CHECK は5値（pending / reviewing / interview / accepted / rejected）だが、
-- アプリの型（src/lib/business/applications.ts）は6値で 'hired'（採用確定・請求トリガー）を
-- 持っている。Migration 144 で hired_confirmed_at / hired_salary は追加されたのに
-- CHECK の更新が漏れていた。
--
-- ⚠️ /biz/applications の「採用確定」ボタンは status='hired' を書こうとするので、
--    このままだと**最初の採用確定が 23514 で失敗する**。
--    ow_job_applications は 2026-08-05 時点で0件なので、まだ誰も踏んでいない。
--
-- ⚠️ 既存行の UPDATE はしない（0件）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_all int; v_def text;
BEGIN
  SELECT count(*) INTO v_all FROM public.ow_job_applications;
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conname = 'ow_job_applications_status_check'
     AND conrelid = 'public.ow_job_applications'::regclass;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'ow_job_applications_status_check が無い。中止';
  END IF;
  IF v_def LIKE '%hired%' THEN
    RAISE EXCEPTION 'すでに hired が許可されている。適用済みの可能性。中止';
  END IF;

  RAISE NOTICE '適用前: % 行 / 制約 = %', v_all, v_def;
END $$;

ALTER TABLE public.ow_job_applications
  DROP CONSTRAINT ow_job_applications_status_check;

ALTER TABLE public.ow_job_applications
  ADD CONSTRAINT ow_job_applications_status_check
  CHECK (status = ANY (ARRAY['pending','reviewing','interview','accepted','rejected','hired']));

COMMENT ON CONSTRAINT ow_job_applications_status_check ON public.ow_job_applications IS
  '許可値は src/lib/business/applications.ts の ApplicationStatus と一致させること。'
  ' 片方だけ増やすと、アプリからは選べるのに保存が 23514 で落ちる（hired がその状態だった）。';

-- ── 事後チェック ────────────────────────────────────────────────────────────
-- ⚠️ 実データを作らずに確認する。行を1件だけ入れて hired に更新し、必ず巻き戻す。
DO $$
DECLARE v_ok boolean := false; v_bad boolean := false; v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint WHERE conname = 'ow_job_applications_status_check'
     AND conrelid = 'public.ow_job_applications'::regclass;
  IF v_def NOT LIKE '%hired%' THEN
    RAISE EXCEPTION '制約に hired が入っていない。ロールバック';
  END IF;

  -- hired が通ること / 不正値が弾かれることを、サブトランザクションで実地確認する
  BEGIN
    INSERT INTO public.ow_job_applications (id, job_id, user_id, name, email, status)
    VALUES ('00000000-0000-0000-0000-0000000000ff'::uuid,
            (SELECT id FROM public.ow_jobs LIMIT 1),
            (SELECT id FROM public.ow_users LIMIT 1),
            'constraint check', 'check@example.invalid', 'hired');
    v_ok := true;
    RAISE EXCEPTION 'rollback_marker';   -- ここで必ず巻き戻す
  EXCEPTION
    WHEN check_violation THEN v_ok := false;
    WHEN OTHERS THEN
      IF SQLERRM <> 'rollback_marker' THEN RAISE; END IF;
  END;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'hired を保存できない。ロールバック';
  END IF;

  BEGIN
    INSERT INTO public.ow_job_applications (id, job_id, user_id, name, email, status)
    VALUES ('00000000-0000-0000-0000-0000000000fe'::uuid,
            (SELECT id FROM public.ow_jobs LIMIT 1),
            (SELECT id FROM public.ow_users LIMIT 1),
            'constraint check', 'check2@example.invalid', 'bogus');
  EXCEPTION WHEN check_violation THEN v_bad := true;
  END;

  IF NOT v_bad THEN
    RAISE EXCEPTION '不正値が弾かれない。ロールバック';
  END IF;

  IF EXISTS (SELECT 1 FROM public.ow_job_applications) THEN
    RAISE EXCEPTION '検証行が残っている。ロールバック';
  END IF;

  RAISE NOTICE '完了: hired を許可。hired が通り、不正値が弾かれ、検証行が残っていないことを確認';
END $$;

COMMIT;
