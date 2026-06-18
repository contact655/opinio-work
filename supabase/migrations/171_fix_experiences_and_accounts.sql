-- Migration 171: employment_type カラム追加 + アカウントデータ修正
--
-- 問題1: ow_experiences に employment_type カラムが存在せず、
--   API (GET/POST) が 400 エラーになっていた
--
-- 問題2: Migration 170 が誤った方向にデータを移動した
--   誤: e826e0bd-... (ログイン中の正しいアカウント) → fe7dfe9b-... (別アカウント)
--   正: fe7dfe9b-... → e826e0bd-... に戻す

-- Part 1: employment_type カラム追加
ALTER TABLE ow_experiences
  ADD COLUMN IF NOT EXISTS employment_type TEXT;

-- Part 2: Migration 170 の誤り修正
DO $$
DECLARE
  v_current_user_id UUID := 'e826e0bd-f96b-42ec-acda-d8f482e1417d'; -- ログイン中 (柴 久人, auth_id=7f358b59-...)
  v_wrong_user_id   UUID := 'fe7dfe9b-75d4-4a75-a821-fa1a9599a416'; -- 誤移管先 (柴久人, auth_id=4a0decfa-...)
  v_count           INT;
BEGIN
  RAISE NOTICE '正しいアカウント: %', v_current_user_id;
  RAISE NOTICE '誤移管先アカウント: %', v_wrong_user_id;

  UPDATE ow_experiences
  SET user_id = v_current_user_id
  WHERE user_id = v_wrong_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'ow_experiences: % 件を正しいアカウントへ移動', v_count;

  UPDATE ow_user_educations
  SET user_id = v_current_user_id
  WHERE user_id = v_wrong_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'ow_user_educations: % 件を正しいアカウントへ移動', v_count;

  UPDATE ow_user_certifications
  SET user_id = v_current_user_id
  WHERE user_id = v_wrong_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'ow_user_certifications: % 件を正しいアカウントへ移動', v_count;

  UPDATE ow_user_skill_tags
  SET user_id = v_current_user_id
  WHERE user_id = v_wrong_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'ow_user_skill_tags: % 件を正しいアカウントへ移動', v_count;
END $$;
