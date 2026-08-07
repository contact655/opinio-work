-- ═══════════════════════════════════════════════════════════════════════════
-- ow_experiences.visibility_company の DEFAULT を 'masked' → 'real' にする
--
-- ── 背景 ────────────────────────────────────────────────────────────────────
-- DB とコードで意図が逆を向いていた。
--   DB   : DEFAULT 'masked'（migration 175 が「機微情報は安全側」として設定）
--   API  : 空なら 'real'（api/jobseeker/experiences/route.ts）
--   UI   : 職歴の追加・編集の初期値が 'real'（CareerHistoryEditor.tsx）
-- 実データも real 13 / masked 1 / hidden 0 で、**DB の既定は一度も使われていない。**
--
-- ── 'real' を正とした根拠（2026-08-07 に画面で確認）──────────────────────────
-- 公開範囲が本人に明示されているため、既定が real でも「本人が選んでいない値」
-- にはならない。確認した内容:
--   ・見出し「公開設定（この職歴を、どの画面に出すか）」が入力欄と同じカードにある
--   ・掲載先ごとに2つの select がある
--       「キャリア軌跡ページ・企業ページ」→ visibility_company
--       「プロフィールページ」            → visibility_company_profile
--   ・選択肢のラベルが日本語で意味を示す
--       実名で表示する / 業界・規模で表示する / 含めない
--   ・初期値「実名で表示する」が select に表示され、本人がその場で変更できる
--   ・説明文が掲載先を具体的に書いている
--       「実名で表示するを選ぶと、その企業の紹介ページ（現役社員 / OB・OG
--         セクション）にあなたのお名前が掲載されます。含めないを選ぶと、
--         どちらのページにも掲載されません。」
--   ・masked を選んだときの表示も実装済み
--       /u/[id]        : lib/utils/timeline.ts が業界・規模の代替ラベルに置換
--       企業ページ経路 : lib/experiences/companyName.ts が「非公開」に置換
--
-- ── 影響範囲 ────────────────────────────────────────────────────────────────
-- ⚠️ **既存行は1行も触らない。** DEFAULT を変えるだけ。
-- ⚠️ 実際の影響も現時点では無い。ow_experiences への INSERT 経路は
--    api/jobseeker/experiences/route.ts の1本だけで、そこは
--    visibility_company を必ず明示して渡している（DB の既定に落ちない）。
--    直しているのは「既定が2箇所で逆を向いている」状態そのもの。
--
-- ⚠️ visibility_company_profile は元から DEFAULT 'real' で、変更しない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_def text;
  v_real int; v_masked int; v_hidden int;
BEGIN
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_experiences' AND column_name='visibility_company';

  IF v_def IS DISTINCT FROM '''masked''::text' THEN
    RAISE EXCEPTION '既定が想定（masked）と違う: %。前提が崩れているので中止', v_def;
  END IF;

  SELECT count(*) FILTER (WHERE visibility_company='real'),
         count(*) FILTER (WHERE visibility_company='masked'),
         count(*) FILTER (WHERE visibility_company='hidden')
    INTO v_real, v_masked, v_hidden
    FROM public.ow_experiences;

  RAISE NOTICE '適用前: 既定=% / real % 件・masked % 件・hidden % 件', v_def, v_real, v_masked, v_hidden;
END $$;

-- ── 本体 ────────────────────────────────────────────────────────────────────
ALTER TABLE public.ow_experiences
  ALTER COLUMN visibility_company SET DEFAULT 'real';

COMMENT ON COLUMN public.ow_experiences.visibility_company IS
  'キャリア軌跡ページ・企業ページでの会社名の出し方。real / masked / hidden。'
  '既定は real（UI と API の初期値に合わせた。2026-08-07）。'
  '⚠️ 既定を変えるときは CareerHistoryEditor の初期値と '
  'api/jobseeker/experiences/route.ts の空欄時の値も同時に変えること。';

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_def text;
  v_real int; v_masked int; v_hidden int;
BEGIN
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_experiences' AND column_name='visibility_company';
  IF v_def IS DISTINCT FROM '''real''::text' THEN
    RAISE EXCEPTION '既定が real になっていない: %。ロールバック', v_def;
  END IF;

  SELECT count(*) FILTER (WHERE visibility_company='real'),
         count(*) FILTER (WHERE visibility_company='masked'),
         count(*) FILTER (WHERE visibility_company='hidden')
    INTO v_real, v_masked, v_hidden
    FROM public.ow_experiences;

  -- 既存行が動いていないこと（masked の1件が real に化けていないか）
  IF v_masked < 1 THEN
    RAISE EXCEPTION '既存の masked 行が消えている（% 件）。ロールバック', v_masked;
  END IF;

  RAISE NOTICE '完了: 既定=% / real % 件・masked % 件・hidden % 件（既存行は不変）', v_def, v_real, v_masked, v_hidden;
END $$;

COMMIT;
