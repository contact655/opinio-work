-- ═══════════════════════════════════════════════════════════════════════════
-- ロゴ差し替え 第2バッチ（パランティア1社）── ★UPDATE は無い。検証だけ（2026-08-28）
--
-- ── なぜ UPDATE が無いのか ──────────────────────────────────────────────────
-- パランティアの `logo_url` は**元から `.../logo.png` を指している**。
-- 実ファイルを `companies/logos/{id}/logo.png` の**固定名 + upsert**で差し替えたので
-- （`scripts/upload-logos-20260828d.mjs`）、**DB を触らなくても反映される**
-- （このオブジェクトの応答は `cache-control: no-cache`。実測で確認済み）。
--
-- ⚠️★**それでも migration を1本置く。** 「いつ・何を・どういう根拠で差し替えたか」を
--    履歴に残すため。**ファイルだけ差し替えると、DB の履歴からは何も追えない。**
--    第1バッチ（`20260828170000`）と対で読めるようにしてある。
--
-- | | 差し替え前 | 後 |
-- |---|---|---|
-- | 実寸 | **2996x1955**（比1.53） | **32x32**（比1.0） |
-- | 見え方 | 黒地の広い画像。**68px に縮めるとマークが極小の点**になる | 32px だが**正方形なので枠いっぱい**に入り、68px でもマークが読める |
-- | 背景 | 黒 | **濃紺 (16,24,32)**。透過ではない |
-- | 出所 | — | `https://www.palantir.com/` の `<link rel=icon>`（ICO の 32px フレームを PNG 化） |
--
-- ⚠️★**画素数は下がる**（2996x1955 → 32x32）。それでも見えやすくなるのは、
--    **枠が正方形だから**。横長画像は縮小時に短辺へ合わせられ、マークが小さくなる。
--    **「解像度が高い＝見やすい」ではない**ことの実例として残す。
--
-- ⚠️ ICO は複数フレームを持つ。パランティアは **16/32 の2フレームしか無く**、
--    最大でも 32px だった。**より大きい素材は取れていない**
--    （ブランド/プレス系10パスも当たったが0件）。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260828-2351-ow_companies.sql（スキーマ+データ / 88行）
--   ⚠️ Storage のファイルは**上書きしている**ので、DB を戻しても絵は戻らない。
--      差し替え前の実ファイルは `.dumps/logos/current/palantir.png` に退避してある。
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_url text; v_null int; v_total int;
BEGIN
  SELECT logo_url INTO v_url FROM public.ow_companies
   WHERE id = 'be74d989-db8f-4be1-882c-40cf94e07fe2';   -- パランティア・テクノロジーズ

  IF v_url IS NULL THEN
    RAISE EXCEPTION 'パランティアの logo_url が NULL。前提が違う。中止';
  END IF;
  IF v_url NOT LIKE '%/companies/logos/be74d989-db8f-4be1-882c-40cf94e07fe2/logo.png' THEN
    RAISE EXCEPTION 'logo_url が想定と違う（%）。中止', v_url;
  END IF;

  -- ★保留2社（PKSHA / フライル）を触っていないこと
  SELECT count(*) INTO v_null FROM public.ow_companies
   WHERE name IN ('株式会社PKSHA Technology','株式会社フライル') AND logo_url IS NULL;
  IF v_null <> 2 THEN RAISE EXCEPTION '保留2社の logo_url が NULL でない。中止'; END IF;

  SELECT count(*) INTO v_total FROM public.ow_companies;
  IF v_total <> 88 THEN RAISE EXCEPTION 'ow_companies が % 行（88 のはず）。中止', v_total; END IF;

  RAISE NOTICE '完了（UPDATE なし・検証のみ）: パランティアは logo.png を指したまま / 保留2社 NULL % / 全 % 行',
    v_null, v_total;
END $$;

COMMIT;
