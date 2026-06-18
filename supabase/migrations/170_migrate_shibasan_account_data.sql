-- Migration 170: 柴さんの旧アカウントから新アカウントへデータ移行
--
-- 背景:
--   柴さんに ow_users レコードが2つ存在する
--   旧アカウント (name='柴 久人', with space): 職歴・学歴・資格データあり
--   新アカウント (name='柴久人', no space):   現在ログイン中、データなし
--
-- この migration でやること:
--   ow_experiences, ow_user_educations, ow_user_certifications を
--   旧アカウントから新アカウントへ移管する

DO $$
DECLARE
  v_old_user_id UUID;
  v_new_user_id UUID;
  v_count       INT;
BEGIN
  -- 旧アカウント (スペースあり "柴 久人")
  SELECT id INTO v_old_user_id
  FROM ow_users
  WHERE name = '柴 久人'
  LIMIT 1;

  -- 新アカウント (スペースなし "柴久人")
  SELECT id INTO v_new_user_id
  FROM ow_users
  WHERE name = '柴久人'
  LIMIT 1;

  IF v_old_user_id IS NULL THEN
    RAISE EXCEPTION '旧アカウント (柴 久人) が見つかりません';
  END IF;

  IF v_new_user_id IS NULL THEN
    RAISE EXCEPTION '新アカウント (柴久人) が見つかりません';
  END IF;

  IF v_old_user_id = v_new_user_id THEN
    RAISE EXCEPTION '旧アカウントと新アカウントが同じIDです。確認してください';
  END IF;

  RAISE NOTICE '旧アカウント: %', v_old_user_id;
  RAISE NOTICE '新アカウント: %', v_new_user_id;

  -- ow_experiences を移管
  UPDATE ow_experiences
  SET user_id = v_new_user_id
  WHERE user_id = v_old_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'ow_experiences: % 件移管', v_count;

  -- ow_user_educations を移管
  UPDATE ow_user_educations
  SET user_id = v_new_user_id
  WHERE user_id = v_old_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'ow_user_educations: % 件移管', v_count;

  -- ow_user_certifications を移管
  UPDATE ow_user_certifications
  SET user_id = v_new_user_id
  WHERE user_id = v_old_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'ow_user_certifications: % 件移管', v_count;

  -- ow_user_skill_tags を移管
  UPDATE ow_user_skill_tags
  SET user_id = v_new_user_id
  WHERE user_id = v_old_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'ow_user_skill_tags: % 件移管', v_count;

END $$;
