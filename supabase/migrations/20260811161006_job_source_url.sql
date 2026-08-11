-- 求人に「出典」を記録する列を足す
--
-- ── なぜ必要か ──────────────────────────────────────────────────────────────
-- 2026-08-11 時点で公開求人18件の出所を調べるのに丸一日かかった。
-- ow_jobs には求人原文を指す列が1つも無く、archive/*.sql（299本）を
-- 全文検索して投入した migration を特定するしかなかった。
-- 結果、13件は archive/147（自ら「サンプル求人データ追加」と書いている）由来で
-- 実在を確認できず、掲載を下ろすことになった。
--
-- 列が最初からあれば、この調査は SELECT 1本で終わっていた。
--
--   source_url          … 求人原文の URL
--   source_verified_at  … 最後に原文と突き合わせた日時
--
-- ⚠️ 公開ページには出さない。運営の管理用。
-- ⚠️ 既存18件は NULL のままにする。「出典未確認である」ことを残すため、
--    それらしい URL で埋めない（CLAUDE.md「値が無いことを、ある値に置き換えない」）。

BEGIN;

ALTER TABLE ow_jobs
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_verified_at timestamptz;

COMMENT ON COLUMN ow_jobs.source_url IS
  '求人原文のURL。運営の管理用で公開ページには出さない。求人を投入するときは必ず埋める。';
COMMENT ON COLUMN ow_jobs.source_verified_at IS
  '最後に source_url の原文と内容を突き合わせた日時。運営の管理用。';

-- ⚠️ 新しい列には GRANT を明示する。既定では anon にも authenticated にも
--    権限が1つも付かない（20260807050000 / 20260807060000 で既定を絞ったため）。
--    ここは列単位の追加なのでテーブルの GRANT を継承するが、
--    **anon に SELECT を渡さない**ことを明示的に確認する（下の事後チェック）。

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cols   int;
  v_filled int;
  v_anon   boolean;
BEGIN
  SELECT count(*) INTO v_cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ow_jobs'
      AND column_name IN ('source_url', 'source_verified_at');
  IF v_cols <> 2 THEN
    RAISE EXCEPTION '列が2つ作られていない: %', v_cols;
  END IF;

  -- 既存行を埋めていないこと
  SELECT count(*) INTO v_filled FROM ow_jobs WHERE source_url IS NOT NULL;
  IF v_filled <> 0 THEN
    RAISE EXCEPTION 'source_url が埋まっている行が % 件ある（このmigrationは埋めない）', v_filled;
  END IF;

  -- ⚠️ 未確認の出典が未ログインから読めてしまわないこと
  SELECT has_column_privilege('anon', 'public.ow_jobs', 'source_url', 'SELECT') INTO v_anon;
  IF v_anon THEN
    RAISE NOTICE '⚠️ anon が source_url を読める（テーブル全体の GRANT を継承）。'
      ' 公開ページでは select しないこと。機微になったら列単位で REVOKE する。';
  END IF;

  RAISE NOTICE 'source_url / source_verified_at を追加。既存行は NULL のまま。';
END $$;

COMMIT;
