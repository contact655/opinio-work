-- ═══════════════════════════════════════════════════════════════════════════
-- 壊れた social_links を1件だけ直す（2026-08-28）
--
-- ── なぜ「データを先に直す」のか ────────────────────────────────────────────
-- `ow_users.social_links` に URL 形式の検証が無く、実データに **`github: "a"`** が
-- 1件だけ入っていた（docs/todo.md「social_links に URL 形式の検証が無い」）。
--
-- ★**検証を入れる前に、壊れた行を 0 件にしておく必要がある。**
--   `social_links` は `PUT /api/jobseeker/profile` に**他の項目と一緒に載る**ので、
--   壊れた値が残ったまま「素直に 400」を入れると、そのユーザーは
--   **名前の変更すら保存できなくなる**（画面から直す手段はあるが、
--   気づかないまま「保存できない」に見える）。
--
--   0 件にしてから厳格な検証を入れれば、todo に挙げていた回避策
--   ——案A「変更されたキーだけ検証する」／案C「UI に印を出す」——は**どちらも要らない**。
--   案B「保存時に黙って落とす」は「入力したものを黙って消す」ことになるので採らない。
--
-- ── 何をするか ──────────────────────────────────────────────────────────────
-- **キーごと落とす**（空文字を入れない）。`optionalTextMap` が空文字のキーを
-- 落とす仕様なので、空文字を残すと API 側の扱いと食い違う。
--
-- ⚠️ 対象は **id で明示列挙**する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
-- ⚠️ 実測（2026-08-28）: 形式が壊れている行は**この1件だけ**。非空は2行。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260828-1530-ow_users.sql（スキーマ+データ / 38行）
--   `"github": "a"` が含まれていることを確認済み。
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_broken int;
  v_before jsonb;
BEGIN
  -- ★対象が想定どおり1件であること。増えていたら中止（見落としを作らない）
  SELECT count(*) INTO v_broken FROM public.ow_users u
   WHERE EXISTS (
     SELECT 1 FROM jsonb_each_text(coalesce(u.social_links, '{}'::jsonb)) kv
      WHERE kv.value <> '' AND kv.value !~ '^https?://'
   );
  IF v_broken <> 1 THEN
    RAISE EXCEPTION '形式が壊れた social_links が % 行（1 のはず）。中止', v_broken;
  END IF;

  SELECT social_links INTO v_before FROM public.ow_users
   WHERE id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d';
  IF v_before IS NULL THEN
    RAISE EXCEPTION '対象ユーザーの social_links が NULL。前提が違う。中止';
  END IF;
  IF v_before ->> 'github' <> 'a' THEN
    RAISE EXCEPTION 'github の値が想定と違う（%）。中止', v_before ->> 'github';
  END IF;

  RAISE NOTICE '適用前: %', v_before;
END $$;

-- ⚠️ キーごと落とす。空文字を残さない
UPDATE public.ow_users
   SET social_links = social_links - 'github'
 WHERE id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d'
   AND social_links ->> 'github' = 'a';   -- ★値まで確認してから落とす

DO $$
DECLARE
  v_broken int;
  v_after  jsonb;
  v_keys   int;
BEGIN
  -- ★壊れた行が 0 になったこと（これが検証を入れる前提）
  SELECT count(*) INTO v_broken FROM public.ow_users u
   WHERE EXISTS (
     SELECT 1 FROM jsonb_each_text(coalesce(u.social_links, '{}'::jsonb)) kv
      WHERE kv.value <> '' AND kv.value !~ '^https?://'
   );
  IF v_broken <> 0 THEN RAISE EXCEPTION '壊れた行が % 行残っている。中止', v_broken; END IF;

  SELECT social_links INTO v_after FROM public.ow_users
   WHERE id = 'e826e0bd-f96b-42ec-acda-d8f482e1417d';

  -- ★他のキーを巻き込んでいないこと（4キー → 3キー）
  SELECT count(*) INTO v_keys FROM jsonb_object_keys(v_after);
  IF v_keys <> 3 THEN RAISE EXCEPTION 'キーが % 個（3 のはず）。他のキーを巻き込んだ。中止', v_keys; END IF;
  IF v_after ? 'github' THEN RAISE EXCEPTION 'github が残っている。中止'; END IF;
  IF NOT (v_after ? 'x' AND v_after ? 'facebook' AND v_after ? 'linkedin') THEN
    RAISE EXCEPTION '残すべきキーが消えている: %。中止', v_after;
  END IF;

  RAISE NOTICE '完了: % / 壊れた行 % 件', v_after, v_broken;
END $$;

COMMIT;
