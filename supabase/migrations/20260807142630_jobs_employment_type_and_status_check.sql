-- ═══════════════════════════════════════════════════════════════════════════
-- ow_jobs.employment_type と ow_jobs.status に CHECK を足す
--
-- ── 背景 ────────────────────────────────────────────────────────────────────
-- どちらも CHECK が無く、API 側の検証も無かった。
--   employment_type: `str(body.employmentType, 50)` で **任意の文字列**が通る
--   status         : PATCH だけ許容値を見ていたが、INSERT 経路は素通り
-- 綴りが1文字ずれても**エラーにならず、一覧のフィルタから静かに消えるだけ**。
-- 経歴側で同じ形のバグ（派遣社員 / アルバイト・パートが null に落ちる）が
-- 1ヶ月以上気づかれなかったため、求人側は DB でも止める。
--
-- ── employment_type ─────────────────────────────────────────────────────────
-- 許容値は求人フォームの5値。**経歴側（ow_experiences）とは意図的に違う。**
--   求人（企業がこれから採る）: インターンあり / その他なし / 派遣社員なし
--   経歴（本人が経験した）    : その他あり / 派遣社員あり / インターンなし
-- 「その他」は求人に出しても求職者に情報が無く、経歴には過去の多様な形態を
-- 収めるために要る。src/lib/constants/careerOptions.ts に2つ並べて置いてある。
--
-- ── status ──────────────────────────────────────────────────────────────────
-- ⚠️ CHECK と API の許容値は**わざと非対称**にしている。
--   CHECK  : 6値（'active' を含む）  ← 読めるもの。過去データの温存
--   API    : 5値（'active' を含まない）← これから設定できるもの
-- 'active' は migration 113 以前の旧値。実データは 0 件だが、
-- 読み取り側12箇所が今も `.in(["published","active"])` で拾っている。
-- CHECK から外すとその12箇所の前提が崩れるので**今回は温存**する。
-- 読み取り側の掃除は別タスク。
--
-- ⚠️ 'closed' / 'expired' は**あえて入れていない**。
--    CLAUDE.md に4値設計として記述はあるが、この2値を設定するコードは無く、
--    表示側（lib/business/jobs.ts の normalizeStatus）も知らないため
--    入れると「DB には入るが画面では draft に化ける」状態を作る。
--    期限切れ遷移を有効化するときは、この CHECK を広げるのと
--    表示側に値を教えるのを**同時にやること**。CHECK がその強制装置になる。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total int;
  v_ng_emp int;
  v_ng_st  int;
BEGIN
  SELECT count(*) INTO v_total FROM public.ow_jobs;

  SELECT count(*) INTO v_ng_emp FROM public.ow_jobs
   WHERE employment_type IS NOT NULL
     AND employment_type <> ALL (ARRAY['正社員','業務委託','契約社員','インターン','アルバイト・パート']);
  IF v_ng_emp > 0 THEN
    RAISE EXCEPTION 'employment_type が新CHECKを通らない行が % 件ある。中止', v_ng_emp;
  END IF;

  SELECT count(*) INTO v_ng_st FROM public.ow_jobs
   WHERE status IS NOT NULL
     AND status <> ALL (ARRAY['draft','pending_review','published','active','rejected','private']);
  IF v_ng_st > 0 THEN
    RAISE EXCEPTION 'status が新CHECKを通らない行が % 件ある。中止', v_ng_st;
  END IF;

  RAISE NOTICE '適用前: ow_jobs % 件 / 通らない行 employment_type 0 件・status 0 件', v_total;
END $$;

-- ── 本体 ────────────────────────────────────────────────────────────────────
ALTER TABLE public.ow_jobs
  DROP CONSTRAINT IF EXISTS ow_jobs_employment_type_check;

ALTER TABLE public.ow_jobs
  ADD CONSTRAINT ow_jobs_employment_type_check
  CHECK (employment_type IS NULL OR employment_type = ANY (ARRAY[
    '正社員'::text, '業務委託'::text, '契約社員'::text,
    'インターン'::text, 'アルバイト・パート'::text
  ]));

COMMENT ON CONSTRAINT ow_jobs_employment_type_check ON public.ow_jobs IS
  '許容値は careerOptions.ts の JOB_EMPLOYMENT_TYPES と一致させること。経歴側の EMPLOYMENT_TYPES とは別物（2026-08-07）';

ALTER TABLE public.ow_jobs
  DROP CONSTRAINT IF EXISTS ow_jobs_status_check;

ALTER TABLE public.ow_jobs
  ADD CONSTRAINT ow_jobs_status_check
  CHECK (status IS NULL OR status = ANY (ARRAY[
    'draft'::text, 'pending_review'::text, 'published'::text,
    'active'::text, 'rejected'::text, 'private'::text
  ]));

COMMENT ON CONSTRAINT ow_jobs_status_check ON public.ow_jobs IS
  'active は旧値の温存（実データ0件・読み取り側12箇所が参照）。API から新規に設定できるのは active を除く5値。closed/expired は表示側が知らないためあえて含めない（2026-08-07）';

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_emp text;
  v_st  text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_emp FROM pg_constraint
   WHERE conrelid='public.ow_jobs'::regclass AND conname='ow_jobs_employment_type_check';
  SELECT pg_get_constraintdef(oid) INTO v_st FROM pg_constraint
   WHERE conrelid='public.ow_jobs'::regclass AND conname='ow_jobs_status_check';

  IF v_emp IS NULL OR v_st IS NULL THEN
    RAISE EXCEPTION 'CHECK が張られていない。ロールバック';
  END IF;
  IF v_emp NOT LIKE '%インターン%' OR v_emp NOT LIKE '%アルバイト・パート%' THEN
    RAISE EXCEPTION 'employment_type の CHECK が想定と違う: %', v_emp;
  END IF;
  IF v_st NOT LIKE '%active%' OR v_st NOT LIKE '%pending_review%' OR v_st NOT LIKE '%private%' THEN
    RAISE EXCEPTION 'status の CHECK が想定と違う: %', v_st;
  END IF;
  -- NULL を許していること（既存の書き込み経路が NULL を入れる余地を残す）
  IF v_emp NOT LIKE '%IS NULL%' OR v_st NOT LIKE '%IS NULL%' THEN
    RAISE EXCEPTION 'CHECK が NULL を弾いている: emp=% / st=%', v_emp, v_st;
  END IF;

  RAISE NOTICE '完了: ow_jobs に employment_type 5値・status 6値の CHECK';
END $$;

COMMIT;
