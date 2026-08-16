-- ═══════════════════════════════════════════════════════════════════════════
-- ow_experiences の公開設定を real に揃える（入力欄の廃止にあわせて）
--
-- 2026-08-16 に職歴モーダルから「公開設定（この職歴を、どの画面に出すか）」の
-- 入力欄3つを外した。以後は誰も値を変えられないので、既存の値を既定に揃える。
--
-- ── 対象を id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）──────
--
-- ⚠️ **1件だけ意図的に除外している。** 下の「除外した1件」を必ず読むこと。
--
-- ── 適用前の実測（2026-08-16）────────────────────────────────────────────
--   ow_experiences 19件
--     real / real / true   … 10
--     real / real / false  … 8   ← 入社理由の非公開
--     masked / real / true … 1   ← is_test（テスト三郎）
--
-- ── ① visibility_company = 'masked' の1件 → 'real' ──────────────────────────
--   `7b3835b6-f1aa-4d3a-b5d2-5b2973a0ffa8`（テスト三郎・**is_test = true**）
--   実在の利用者ではないので、意思を上書きすることにはならない。
--   ⚠️ 実データで masked を選んでいた人は**いなかった**（確認済み）。
--
-- ── ② visibility_reason = false の8件のうち **7件** → true ──────────────────
--   7件は**入社理由が空**（自由記述なし・理由タグ0）。true にしても公開されるものが
--   無いので、実質的な公開範囲は変わらない。
--
-- ── ★除外した1件（false のまま残す）────────────────────────────────────────
--   `337c8096-a710-4070-a852-679e28441f07`（大塚悠貴・**is_test = false**）
--   **入社理由の自由記述が実際に入っており、本人が非公開にしている。**
--   true にすると「本人が非公開にした文章を運営が公開する」ことになるため、
--   ここでは触らない（CLAUDE.md「ユーザー側の非公開希望を常に優先する」／
--   「設定の意味を後から拡大しない」）。
--
--   ⚠️ 入力欄が無くなったので、**本人が自分で戻すことはできない。**
--      公開してよいかは本人に確認してから、別の migration で変えること。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_total int; v_masked int; v_reason_false int;
BEGIN
  SELECT count(*) INTO v_total FROM public.ow_experiences;
  SELECT count(*) INTO v_masked FROM public.ow_experiences
   WHERE visibility_company <> 'real' OR visibility_company_profile <> 'real';
  SELECT count(*) INTO v_reason_false FROM public.ow_experiences WHERE visibility_reason IS false;
  IF v_total <> 19 THEN RAISE EXCEPTION 'ow_experiences が % 件（想定19）。中止', v_total; END IF;
  IF v_masked <> 1 THEN RAISE EXCEPTION 'real 以外が % 件（想定1）。中止', v_masked; END IF;
  IF v_reason_false <> 8 THEN RAISE EXCEPTION 'reason=false が % 件（想定8）。中止', v_reason_false; END IF;
  RAISE NOTICE '適用前: 19件 / real 以外 1件 / reason=false 8件';
END $$;

-- ① 会社名の公開設定を real に揃える（対象は is_test の1件だけ）
UPDATE public.ow_experiences
   SET visibility_company = 'real', visibility_company_profile = 'real'
 WHERE id = '7b3835b6-f1aa-4d3a-b5d2-5b2973a0ffa8';

-- ② 入社理由が空の7件だけ true にする
--    ⚠️ 337c8096… は自由記述があるので**含めない**（上のコメント参照）
UPDATE public.ow_experiences
   SET visibility_reason = true
 WHERE id IN (
   '2e3d441d-5fee-499f-9bdf-2f539923bac4',
   '08452923-7db1-494b-9608-9a27ffbe134b',
   'a8df77c5-428f-4d72-971e-2de86a553751',
   '43034e0d-67fb-49bd-9490-58bf82c8c45c',
   'e6ad36b6-b386-4964-8dd8-bbc9c705f032',
   '61bd3d56-8716-4d74-8ff4-d3b5709dd9da',
   '6610a9c2-80a6-400b-8efd-47a74a38211f'
 );

DO $$
DECLARE v_not_real int; v_reason_false int; v_kept int;
BEGIN
  SELECT count(*) INTO v_not_real FROM public.ow_experiences
   WHERE visibility_company <> 'real' OR visibility_company_profile <> 'real';
  IF v_not_real <> 0 THEN RAISE EXCEPTION 'real 以外が % 件残っている。ロールバック', v_not_real; END IF;

  SELECT count(*) INTO v_reason_false FROM public.ow_experiences WHERE visibility_reason IS false;
  IF v_reason_false <> 1 THEN RAISE EXCEPTION 'reason=false が % 件（想定1・意図的な除外）。ロールバック', v_reason_false; END IF;

  -- 残した1件が「除外すると決めたその行」であることを確かめる
  SELECT count(*) INTO v_kept FROM public.ow_experiences
   WHERE visibility_reason IS false AND id = '337c8096-a710-4070-a852-679e28441f07';
  IF v_kept <> 1 THEN RAISE EXCEPTION '残っている1件が別の行。ロールバック'; END IF;

  IF (SELECT count(*) FROM public.ow_experiences) <> 19 THEN
    RAISE EXCEPTION '件数が変わった。ロールバック';
  END IF;
  RAISE NOTICE '完了: 会社名は全件 real / 入社理由は 18件 true・1件 false（意図的に除外）';
END $$;

COMMIT;
