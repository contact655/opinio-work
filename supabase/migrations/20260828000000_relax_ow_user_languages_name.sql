-- ═══════════════════════════════════════════════════════════════════════════
-- ow_user_languages.name を nullable にする（2026-08-28）
--
-- ★**これは「落とす」ための第1段。列はまだ消さない。**
--
-- ── なぜ2段に分けるか ───────────────────────────────────────────────────────
-- `name` は **NOT NULL・既定値なし**。いきなり DROP すると、
-- **どちらの順で出しても壊れる窓ができる**:
--   migration を先に当てる → 旧コードは `name` を INSERT して 42703 で落ちる
--   コードを先に出す       → 新コードは `name` を送らないので NOT NULL で落ちる
--
-- **nullable にするのは緩和**なので、旧コード（`name` を送る）も
-- 新コード（送らない）も**どちらも通る**。この状態を挟めば窓が消える。
--   ① この migration（緩和）      ← いまここ
--   ② `name` を読まない・書かないコードを出す
--   ③ `name` を DROP する
--
-- ⚠️ CLAUDE.md「追加のみは先行適用してよい／削除はコードのデプロイと同時」。
--    **緩和は追加と同じ側**（古いコードを壊さない）。
--
-- ── なぜ落とすのか ──────────────────────────────────────────────────────────
-- `name` は `ow_languages.label` の**複製**で、正は `language_id`（2026-08-27）。
-- 残していたのは読み手2つ（`u/[id]/page.tsx` / `mypage/page.tsx`）が
-- 別セッションの作業中で触れなかったため。**2026-08-27 に両方とも空いた。**
--
-- 実測（2026-08-28）: `ow_user_languages` は **0 行**。移行するデータは無い。
-- 作業前ダンプ: .dumps/20260828-0007-ow_user_languages.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_rows int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='ow_user_languages' AND column_name='name') THEN
    RAISE EXCEPTION 'ow_user_languages.name が存在しない。適用済みか、前提が違う。中止';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='ow_user_languages'
                AND column_name='name' AND is_nullable='YES') THEN
    RAISE EXCEPTION 'ow_user_languages.name は既に nullable。適用済み。中止';
  END IF;
  SELECT count(*) INTO v_rows FROM public.ow_user_languages;
  RAISE NOTICE '適用前: ow_user_languages % 行', v_rows;
END $$;

ALTER TABLE public.ow_user_languages ALTER COLUMN name DROP NOT NULL;

comment on column public.ow_user_languages.name is
  '⚠️【廃止予定】ow_languages.label の複製。正は language_id。2026-08-28 に nullable にした（DROP の第1段）。新しく読み書きしないこと。';

DO $$
DECLARE v_nullable text;
BEGIN
  SELECT is_nullable INTO v_nullable FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_user_languages' AND column_name='name';
  IF v_nullable <> 'YES' THEN RAISE EXCEPTION 'nullable になっていない（% ）。中止', v_nullable; END IF;

  -- ★language_id 側は触っていないこと（正のほうを壊さない）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='ow_user_languages' AND column_name='language_id') THEN
    RAISE EXCEPTION 'language_id が消えている。中止';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.ow_user_languages'::regclass
                    AND conname='ow_user_languages_user_language_uniq') THEN
    RAISE EXCEPTION 'unique (user_id, language_id) が消えている。中止';
  END IF;

  RAISE NOTICE '完了: name は nullable になった（列はまだ残っている）';
END $$;

COMMIT;
