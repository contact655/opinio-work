-- 生藤 弘樹さんの職歴のうち、社名を伏せていた2行を実名公開に変更する。
--
-- 対象は visibility_company = 'masked' のセールスフォース・ジャパン2行
--   - 2022-07〜2024-01（Account Executive）
--   - 2026-07〜現在（Enterprise Account Executive / is_current）
--
-- 本人確認済み（2026-08-03）。経歴上も実名でよいとの回答。
--
-- この変更により、LP の人物帯（その転職を、すでにした人）の公開可否判定
-- （起点と現職の visibility_company がともに 'real' か）を通るようになり、
-- DB_BAND_LABELS に登録すれば帯に表示される。
--
-- ⚠️ 他人の行を巻き込まないよう user_id と現在値の両方で絞り、
--    件数が想定と違えば中断する。

DO $$
DECLARE
  v_shodo   uuid := '0c99e403-7540-4cf9-8bb1-67571af4f2b6';
  v_before  int;
  v_updated int;
  v_masked_left int;
BEGIN
  SELECT count(*) INTO v_before
  FROM ow_experiences
  WHERE user_id = v_shodo AND visibility_company = 'masked';

  IF v_before <> 2 THEN
    RAISE EXCEPTION
      'masked の行数が想定と異なります: 期待 2 / 実際 % 。状況が変わっているため中断します。', v_before;
  END IF;

  UPDATE ow_experiences
  SET visibility_company = 'real',
      updated_at         = now()
  WHERE user_id = v_shodo
    AND visibility_company = 'masked';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> 2 THEN
    RAISE EXCEPTION '更新件数が想定と異なります: 期待 2 / 実際 % 。ロールバックします。', v_updated;
  END IF;

  -- 事後確認: この人に masked が残っていないこと
  SELECT count(*) INTO v_masked_left
  FROM ow_experiences
  WHERE user_id = v_shodo AND visibility_company = 'masked';

  IF v_masked_left <> 0 THEN
    RAISE EXCEPTION 'masked が % 行残っています。ロールバックします。', v_masked_left;
  END IF;

  RAISE NOTICE '生藤さんの職歴 % 行を masked → real に変更しました', v_updated;
END $$;
