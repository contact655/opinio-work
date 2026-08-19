-- ═══════════════════════════════════════════════════════════════════════════
-- 入社理由・退職理由：軸を揃えてスラッグを作り直し、選択上限を3つにする（2026-08-19）
--
-- ── なぜ今か ─────────────────────────────────────────────────────────────
--   適用直前の実測: join_reasons / join_reason_primary / leave_reasons が
--   **すべて0件**。`ow_experience_gaps` も0件。
--   スラッグの削除・改名ができるのは**実データが0件のこの時点だけ**。
--   1件でも入ったら、過去の回答が意味を失うので二度とやらない。
--   → 以後は `src/lib/constants/careerReasons.ts` の「追加のみ」ルールに戻る。
--
-- ── 何のために揃えるか ───────────────────────────────────────────────────
--   入社側と退職側に**同じ軸・同じスラッグ**を置くことで、
--   「裁量を決め手に入った人の何%が、裁量を理由に辞めているか」が出せるようになる。
--   直す前は入社 `growth`（事業の成長性）と退職 `outlook`（事業の先行き）のように
--   **同じことを別のスラッグで持っていて突き合わせられなかった。**
--
--   ⚠️ 軸（仕事の中身 / 裁量・役割 / 人・組織 / 待遇 / 働き方 / 会社の状態 / 個人の事情）は
--      **DB に持たせない。** careerReasons.ts にしか無い。軸は後から切り方を変える前提で、
--      CHECK に入れると変更のたびに migration が要る。DB は選択肢スラッグだけを保存する。
--
-- ── 旧 → 新の対応表 ─────────────────────────────────────────────────────
--   入社（join_reasons）
--     business    → job_content   （改名）
--     autonomy    → autonomy + position （「裁量・ポジション」を2つに分割）
--     people      → people        （据え置き。ラベルは「面接で会った人」→「一緒に働く人」）
--     salary      → salary        （据え置き）
--     growth      → growth        （据え置き）
--     work_style  → work_style    （据え置き）
--     skills      → skills        （据え置き）
--     stability   → stability     （据え置き。入社側のみ）
--     （新規）    → culture / evaluation / personal
--
--   退職（leave_reasons）
--     salary        → salary        （据え置き）
--     evaluation    → evaluation    （据え置き）
--     management    → management    （据え置き。退職側のみ）
--     outlook       → growth        （★改名。入社側と揃える）
--     job_fit       → job_content   （★改名。入社側と揃える）
--     work_style    → work_style    （据え置き）
--     relationships → people        （★改名。入社側と揃える）
--     company       → restructure   （★改名。「会社都合・組織変更」の意味を明確化）
--     （新規）      → skills / autonomy / position / culture / personal
--
--   共通スラッグ11個: job_content skills autonomy position people culture
--                     salary evaluation work_style growth personal
--   片側のみ: 入社 stability / 退職 management restructure
--
-- ── 上限3つ ──────────────────────────────────────────────────────────────
--   `array_length(..., 1) <= 3` を CHECK に入れる。
--   ⚠️ **UI（CareerHistoryEditor）/ API（parseReasonFields）/ DB の3層に同じ上限を入れる**
--      （CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」）。
--      DB だけ入れると「選べるのに保存できない」、UI だけ入れると
--      「API を直に叩けば何個でも入る」になる。
--
-- ⚠️ `ow_experiences_join_reason_primary_check`（決め手は選んだ理由の中の1つ）は**触らない**。
--    上限3つになっても条件は変わらない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_join int; v_primary int; v_leave int; v_gaps int;
BEGIN
  -- ★スラッグを作り直せるのは0件のときだけ。1件でもあれば中止する。
  SELECT count(*) INTO v_join    FROM public.ow_experiences WHERE join_reasons IS NOT NULL;
  SELECT count(*) INTO v_primary FROM public.ow_experiences WHERE join_reason_primary IS NOT NULL;
  SELECT count(*) INTO v_leave   FROM public.ow_experiences WHERE leave_reasons IS NOT NULL;
  SELECT count(*) INTO v_gaps    FROM public.ow_experience_gaps;
  IF v_join <> 0 OR v_primary <> 0 OR v_leave <> 0 THEN
    RAISE EXCEPTION
      '理由データが既に入っている（join=% / primary=% / leave=%）。スラッグの改名は中止',
      v_join, v_primary, v_leave;
  END IF;

  -- 旧 CHECK が想定どおり存在すること（別の migration が先に触っていないか）
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.ow_experiences'::regclass
                    AND conname='ow_experiences_join_reasons_check') THEN
    RAISE EXCEPTION 'ow_experiences_join_reasons_check が無い。中止';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.ow_experiences'::regclass
                    AND conname='ow_experiences_leave_reasons_check') THEN
    RAISE EXCEPTION 'ow_experiences_leave_reasons_check が無い。中止';
  END IF;

  RAISE NOTICE '適用前: 理由データ 0件（gaps % 件）。作り直してよい状態', v_gaps;
END $$;

ALTER TABLE public.ow_experiences DROP CONSTRAINT ow_experiences_join_reasons_check;
ALTER TABLE public.ow_experiences DROP CONSTRAINT ow_experiences_leave_reasons_check;

ALTER TABLE public.ow_experiences ADD CONSTRAINT ow_experiences_join_reasons_check CHECK (
  join_reasons IS NULL OR (
    join_reasons <@ ARRAY[
      'job_content', 'skills',
      'autonomy', 'position',
      'people', 'culture',
      'salary', 'evaluation',
      'work_style',
      'growth', 'stability',
      'personal'
    ]::text[]
    AND array_length(join_reasons, 1) <= 3
  )
);

ALTER TABLE public.ow_experiences ADD CONSTRAINT ow_experiences_leave_reasons_check CHECK (
  leave_reasons IS NULL OR (
    leave_reasons <@ ARRAY[
      'job_content', 'skills',
      'autonomy', 'position',
      'people', 'culture', 'management',
      'salary', 'evaluation',
      'work_style',
      'growth', 'restructure',
      'personal'
    ]::text[]
    AND array_length(leave_reasons, 1) <= 3
  )
);

COMMENT ON COLUMN public.ow_experiences.join_reasons IS
  '入社理由（複数選択・スラッグ・最大3つ）。**非公開。本人と集計のみ。** '
  '軸（work/role/org/pay/worklife/company/personal）は src/lib/constants/careerReasons.ts にのみ持つ。'
  '⚠️ 2026-08-19 にスラッグを作り直した（実データ0件だったため）。以後は追加のみ。';

COMMENT ON COLUMN public.ow_experiences.leave_reasons IS
  '退職理由（複数選択・スラッグ・最大3つ）。**非公開。本人と集計のみ。** '
  '入社理由と11個のスラッグを共有し、軸を突き合わせられるようにしてある。'
  '⚠️ is_current=true の行には入らない想定だが CHECK では縛っていない（保存が落ちるのを避けるため）。'
  '入力UIは「終了日が入っている在籍」にだけ出す（hasLeftCompany）。';

DO $$
DECLARE v_join text; v_leave text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_join FROM pg_constraint
   WHERE conrelid='public.ow_experiences'::regclass AND conname='ow_experiences_join_reasons_check';
  SELECT pg_get_constraintdef(oid) INTO v_leave FROM pg_constraint
   WHERE conrelid='public.ow_experiences'::regclass AND conname='ow_experiences_leave_reasons_check';

  -- ① 新しいスラッグが入っていること
  IF v_join !~ 'job_content' OR v_join !~ 'position' OR v_join !~ 'culture' OR v_join !~ 'personal' THEN
    RAISE EXCEPTION '入社側の CHECK に新スラッグが入っていない: %', v_join;
  END IF;
  IF v_leave !~ 'restructure' OR v_leave !~ 'job_content' OR v_leave !~ 'growth' THEN
    RAISE EXCEPTION '退職側の CHECK に新スラッグが入っていない: %', v_leave;
  END IF;

  -- ② 旧スラッグが残っていないこと（改名し損ねの検出）
  IF v_join ~ '''business''' OR v_leave ~ '''outlook''' OR v_leave ~ '''job_fit'''
     OR v_leave ~ '''relationships''' THEN
    RAISE EXCEPTION '旧スラッグが CHECK に残っている: join=% / leave=%', v_join, v_leave;
  END IF;

  -- ③ 上限が入っていること
  IF v_join !~ 'array_length' OR v_leave !~ 'array_length' THEN
    RAISE EXCEPTION '上限（array_length <= 3）が CHECK に入っていない';
  END IF;

  -- ④ 述語そのものを評価して、意図どおり通す／弾くことを確かめる
  IF NOT (ARRAY['job_content','autonomy','salary']::text[] <@ ARRAY[
      'job_content','skills','autonomy','position','people','culture',
      'salary','evaluation','work_style','growth','stability','personal']::text[]) THEN
    RAISE EXCEPTION '3つの正しい値が通らない';
  END IF;
  IF (ARRAY['business']::text[] <@ ARRAY[
      'job_content','skills','autonomy','position','people','culture',
      'salary','evaluation','work_style','growth','stability','personal']::text[]) THEN
    RAISE EXCEPTION '旧スラッグ business が通ってしまう';
  END IF;
  IF (array_length(ARRAY['job_content','skills','autonomy','position']::text[], 1) <= 3) THEN
    RAISE EXCEPTION '4つ選んでも上限に当たらない';
  END IF;

  RAISE NOTICE '適用後: 入社12値 / 退職13値 / 上限3つ。旧スラッグは弾かれる';
END $$;

COMMIT;
