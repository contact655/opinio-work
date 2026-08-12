-- 企業にも is_test フラグを持たせる（ow_users / ow_jobs と同じ慣行）
--
-- ── なぜ status や listing_status を使わないか ──────────────────────────────
-- 「テストデータである」ことは、公開の可否ともディレクトリ掲載の可否とも**別の軸**。
-- 2026-08-12 に `listing_status` で詳細とディレクトリを2軸に分けたばかりで、
-- そこにテストの意味まで載せると同じ曖昧さを作り直すことになる。
-- 軸が3つあるなら列も3つ持つ。
--
--   ow_users.is_test  … archive/276 / 277 で導入（26人中20人）
--   ow_jobs.is_test   … 20260811174115 で導入（20件中2件）
--   ow_companies.is_test … 本migration
--
-- ── 対象（1社だけ）──────────────────────────────────────────────────────────
--   81cae8d8-38bf-4497-8fa1-1fbb2741239d  株式会社Third Box
--
--   実体のある「株式会社Opinio」（cf44d740-…）とは別行の空スタブ。
--   description が0文字・求人0件・ツール0件で、`ow_company_tools` の
--   動作確認用に作られたとみられる（CLAUDE.md「⑥ ツール・技術スタック」に
--   この company_id が検証対象として記録されている）。
--
-- ── **true にしない**もの（2026-08-12 判断）──────────────────────────────────
--   スマートキャンプ / アサヒビール … 説明も製品もある**未公開の実企業**
--   海光電業                        … is_published=true かつ listing_status=draft は
--                                     「詳細は見えるがディレクトリに出さない」意図的な運用
--   株式会社エージェント / データプール … 確認中のため保留
--
-- ⚠️ `ow_company_admins` の担当者は本migrationの対象外。
--    人のテスト判定は `ow_users.is_test` の役目で、企業側とは別軸。
--    加えて10行すべて accepted_at が空（誰も招待を承諾していない）ため、
--    招待フロー全体で別途扱う。
--
-- ⚠️ 件数の検証は**変更前後の差分**で行う（固定値を使わない）。
--    別セッションが企業を追加・削除しうるため。

BEGIN;

ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN ow_companies.is_test IS
  '検証用の企業。公開側のクエリ（lib/companies/visibility.ts）から除外し、運営画面では件数を併記して存在は見えるようにする。ow_users.is_test / ow_jobs.is_test と同じ慣行。';

DO $$
DECLARE
  v_target   uuid := '81cae8d8-38bf-4497-8fa1-1fbb2741239d';
  v_exists   int;
  v_pub_before int;
  v_pub_after  int;
  v_test     int;
  v_test_pub int;
BEGIN
  -- ── 事前チェック ──────────────────────────────────────────────────────────
  SELECT count(*) INTO v_exists FROM ow_companies WHERE id = v_target;
  IF v_exists <> 1 THEN
    RAISE EXCEPTION '対象（株式会社Third Box）が見つからない: %', v_exists;
  END IF;

  -- ⚠️ 公開中の企業をテスト扱いにしない
  IF EXISTS (SELECT 1 FROM ow_companies WHERE id = v_target AND is_published) THEN
    RAISE EXCEPTION '対象が公開中。テスト扱いにする前に掲載方針を決めること';
  END IF;

  SELECT count(*) INTO v_pub_before FROM ow_companies WHERE is_published;

  -- ── 本処理 ────────────────────────────────────────────────────────────────
  UPDATE ow_companies SET is_test = true, updated_at = now() WHERE id = v_target;

  -- ── 事後チェック ──────────────────────────────────────────────────────────
  SELECT count(*) INTO v_test FROM ow_companies WHERE is_test;
  IF v_test <> 1 THEN
    RAISE EXCEPTION 'is_test が1社でない: %', v_test;
  END IF;

  SELECT count(*) INTO v_test_pub FROM ow_companies WHERE is_test AND is_published;
  IF v_test_pub <> 0 THEN
    RAISE EXCEPTION '公開中なのに is_test の企業が % 社ある', v_test_pub;
  END IF;

  -- 公開企業の数は1社も動かないこと（対象は元から非公開）
  SELECT count(*) INTO v_pub_after FROM ow_companies WHERE is_published;
  IF v_pub_after <> v_pub_before THEN
    RAISE EXCEPTION '公開企業数が変わった: % → %', v_pub_before, v_pub_after;
  END IF;

  RAISE NOTICE 'ow_companies.is_test を追加し、株式会社Third Box に付与した。公開企業数は % のまま。', v_pub_after;
END $$;

COMMIT;
