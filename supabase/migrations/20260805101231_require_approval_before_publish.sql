-- ═══════════════════════════════════════════════════════════════════════════
-- 企業の公開に承認を必須にする（DB制約）
--
--   CHECK (is_published = false OR is_approved = true)
--
-- ── なぜ要るか（2026-08-05）────────────────────────────────────────────────
-- 「承認されていない企業は公開できない」を守っていたのは
-- PATCH /api/biz/company の1箇所だけだった（api/biz/company/route.ts:113）。
-- migration や SQL で直接 is_published = true にすれば承認を飛ばせる状態で、
-- しかも実運用の公開は migration 経由が主（published_at が85社すべて NULL＝
-- アプリ経由の公開実績ゼロ）。つまり**通っている経路の側にだけガードが無い**。
--
-- ow_company_members の check_public_requires_consent
--   (is_public = false OR display_consent = true)
-- と同じ形にして、DB 側で守る。
--
-- ⚠️ 2026-08-05 時点で違反する行は0件。
--      is_approved=false / is_published=false : 8社（承認待ち。CTC・海光電業を含む）
--      is_approved=true  / is_published=false : 1社（承認済み・未公開）
--      is_approved=true  / is_published=true  : 76社
--    「未承認なのに公開」は0社なので、既存データはそのまま通る。
--
-- ⚠️ この制約が入ったあと、企業を公開する migration は is_approved = true が前提になる。
--    承認を飛ばした公開は 23514 で弾かれる。
--    docs/deleting-and-publishing-checklist.md にも記載した。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_bad int; v_all int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'check_published_requires_approval'
       AND conrelid = 'public.ow_companies'::regclass
  ) THEN
    RAISE EXCEPTION '制約が既にある。適用済みの可能性。中止';
  END IF;

  SELECT count(*) INTO v_all FROM public.ow_companies;
  SELECT count(*) INTO v_bad
    FROM public.ow_companies
   WHERE is_published = true AND is_approved IS DISTINCT FROM true;

  IF v_bad > 0 THEN
    RAISE EXCEPTION
      '未承認なのに公開中の企業が % 件ある。制約を張ると既存データが弾かれる。'
      ' 先にデータ側の是正方針を決めること。中止', v_bad;
  END IF;

  RAISE NOTICE '適用前: 全 % 社 / 違反 % 件', v_all, v_bad;
END $$;

-- ── 制約 ──────────────────────────────────────────────────────────────────
-- 命名は既存の check_public_requires_consent に揃える
ALTER TABLE public.ow_companies
  ADD CONSTRAINT check_published_requires_approval
  CHECK (is_published = false OR is_approved = true);

COMMENT ON CONSTRAINT check_published_requires_approval ON public.ow_companies IS
  '公開には運営の承認が要る。is_published = true には is_approved = true が必要。'
  ' アプリ側は PATCH /api/biz/company が同じ判定をしているが、migration / SQL からの'
  ' 直接公開を防げないため DB 側にも置いている。';

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_target uuid;
  v_fired boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'check_published_requires_approval'
       AND conrelid = 'public.ow_companies'::regclass
  ) THEN
    RAISE EXCEPTION '制約が作られていない。ロールバック';
  END IF;

  -- 実際に弾かれることを確かめる。
  -- ⚠️ サブトランザクション（BEGIN ... EXCEPTION）なので、UPDATE の効果は
  --    例外で必ず巻き戻る。データは変わらない。
  SELECT id INTO v_target
    FROM public.ow_companies
   WHERE is_approved IS DISTINCT FROM true AND is_published = false
   LIMIT 1;

  IF v_target IS NULL THEN
    RAISE NOTICE '未承認の企業が無いため、弾かれることの実地確認はスキップ';
  ELSE
    BEGIN
      UPDATE public.ow_companies SET is_published = true WHERE id = v_target;
      -- ここに到達したら制約が効いていない
    EXCEPTION WHEN check_violation THEN
      v_fired := true;
    END;

    IF NOT v_fired THEN
      RAISE EXCEPTION '未承認の企業を公開できてしまった。制約が効いていない。ロールバック';
    END IF;
  END IF;

  -- 念のため、行が動いていないこと
  IF EXISTS (
    SELECT 1 FROM public.ow_companies
     WHERE is_published = true AND is_approved IS DISTINCT FROM true
  ) THEN
    RAISE EXCEPTION '未承認なのに公開の行ができている。ロールバック';
  END IF;

  RAISE NOTICE '完了: check_published_requires_approval を追加。未承認の公開が 23514 で弾かれることを確認';
END $$;

COMMIT;
