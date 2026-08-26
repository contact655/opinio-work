-- 株式会社データプールを検証用（is_test）にする（2026-08-26）
--
-- 根拠（2026-08-26 実測）:
--   ・管理者が @opinio.co.jp（運営自身）。企業の担当者ではない
--   ・url / description / employee_count / location / tagline すべて NULL
--   ・求人0件 / ow_company_members 0件 / この企業を参照する経歴 0件
--   ・created_at 2026-07-23。/biz の企業登録フローを試した残骸と判断した
--
-- ⚠️ 同名の実在企業（大阪の映像制作会社・法人番号 8170001008340）とは同定できない。
--    この行には URL も所在地も無く、突き合わせる材料が1つも無い。
--    **実在企業のデータを入れない。**
--
-- ⚠️ `industry_id`（IT・ソフトウェア）は 20260825110000 の再構築で機械的に付けた値で、
--    この企業について調べた結果ではない。**この migration では触らない。**
--
-- ⚠️ 直近に同じ列を触った migration: 20260812120937_company_is_test_flag.sql
--    （列の導入と1社への設定）。打ち消していないことを確認済み——あちらは別の企業を
--    対象にしており、件数アサートも「1社」から増える前提で書かれていない。
--    ここでは2社になることを明示的に確かめる。

begin;

do $$
DECLARE
  v_target uuid;
  v_before int;
  v_after  int;
BEGIN
  SELECT id INTO v_target FROM ow_companies WHERE name = '株式会社データプール';
  IF v_target IS NULL THEN
    RAISE EXCEPTION '株式会社データプール が見つからない。中止する';
  END IF;

  -- ⚠️ 対象が想定どおり「空の行」であることを確かめてから触る
  IF EXISTS (
    SELECT 1 FROM ow_companies
     WHERE id = v_target
       AND (url IS NOT NULL OR description IS NOT NULL OR employee_count IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'データプールに中身が入っている。空の行ではないので中止する';
  END IF;
  IF EXISTS (SELECT 1 FROM ow_jobs WHERE company_id = v_target)
     OR EXISTS (SELECT 1 FROM ow_experiences WHERE company_id = v_target)
     OR EXISTS (SELECT 1 FROM ow_company_members WHERE company_id = v_target) THEN
    RAISE EXCEPTION 'データプールを参照する求人・経歴・メンバーがある。中止する';
  END IF;

  SELECT count(*) INTO v_before FROM ow_companies WHERE is_test;

  UPDATE ow_companies SET is_test = true, updated_at = now() WHERE id = v_target;

  SELECT count(*) INTO v_after FROM ow_companies WHERE is_test;
  RAISE NOTICE 'is_test の企業: % → %', v_before, v_after;
  IF v_after <> v_before + 1 THEN
    RAISE EXCEPTION 'is_test の件数が想定と違う（% → %）。中止する', v_before, v_after;
  END IF;
END $$;

commit;
