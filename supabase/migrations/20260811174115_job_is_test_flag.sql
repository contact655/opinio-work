-- 求人にも is_test フラグを持たせ、テストデータを status ではなく専用の列で表す
--
-- ── なぜ status を使わないか ────────────────────────────────────────────────
-- 自社（株式会社Opinio）に「テスト」という求人が2件あり、status は draft のまま。
-- `private` に逃がす案もあったが採らない。
-- `private` の意味は「一度公開したものを運営が止めた」であって、
-- テストデータ置き場ではない。**2026-08-11 に `active` を削除して
-- status の語彙を5値に整理したばかりで、同じ曖昧さを作り直すことになる。**
--
-- ⚠️ テストデータの分類は `ow_users.is_test` に既存の慣行がある
--    （archive/276 / 277 で導入、2026-08-11 時点で26人中20人）。そこに揃える。
--
-- ── 対象 ────────────────────────────────────────────────────────────────────
--   94c4d533-8413-4f94-bd1d-53cc0ace3d39  株式会社Opinio / 「テスト」
--   6b18cfad-6c3f-41ca-b0eb-3da7230572dc  株式会社Opinio / 「テスト」
--
-- ⚠️ status は draft のまま変えない。「下書き」であることと
--    「テストデータ」であることは別の軸。
--
-- ⚠️ この2件は 2026-08-11 まで**自社の公開企業ページに「募集中 2件」として出ており、
--    押すと 404 だった**（getCompanyById に status の絞りが無かったため）。
--    そちらは同日に修正済み。本migrationは分類だけを直す。

BEGIN;

ALTER TABLE ow_jobs
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN ow_jobs.is_test IS
  '検証用の求人。運営画面では専用タブに分け、公開側のクエリからは除外する。ow_users.is_test と同じ慣行。';

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_exists int;
  v_draft  int;
BEGIN
  SELECT count(*) INTO v_exists FROM ow_jobs
   WHERE id IN ('94c4d533-8413-4f94-bd1d-53cc0ace3d39', '6b18cfad-6c3f-41ca-b0eb-3da7230572dc');
  IF v_exists <> 2 THEN
    RAISE EXCEPTION '対象2件が揃っていない: %', v_exists;
  END IF;

  -- ⚠️ 公開中の求人を誤ってテスト扱いにしない
  SELECT count(*) INTO v_draft FROM ow_jobs
   WHERE id IN ('94c4d533-8413-4f94-bd1d-53cc0ace3d39', '6b18cfad-6c3f-41ca-b0eb-3da7230572dc')
     AND status = 'draft';
  IF v_draft <> 2 THEN
    RAISE EXCEPTION '対象2件が draft でない: %', v_draft;
  END IF;
END $$;

UPDATE ow_jobs SET is_test = true
 WHERE id IN ('94c4d533-8413-4f94-bd1d-53cc0ace3d39', '6b18cfad-6c3f-41ca-b0eb-3da7230572dc');

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_test int;
  v_pub  int;
BEGIN
  SELECT count(*) INTO v_test FROM ow_jobs WHERE is_test;
  IF v_test <> 2 THEN
    RAISE EXCEPTION 'is_test が2件でない: %', v_test;
  END IF;

  -- ⚠️ 公開中の求人に is_test が付いていないこと
  SELECT count(*) INTO v_pub FROM ow_jobs WHERE is_test AND status = 'published';
  IF v_pub <> 0 THEN
    RAISE EXCEPTION '公開中なのに is_test の求人が % 件ある', v_pub;
  END IF;

  RAISE NOTICE 'ow_jobs.is_test を追加し、テスト求人2件に付与した（status は draft のまま）。';
END $$;

COMMIT;
