-- Migration 228: Delete Hisato's personal test data
-- All records belong to user e826e0bd (hshiba@opinio.co.jp / s.hisato1020@gmail.com).
-- FK references confirmed zero before deletion.

-- 1. Test job experiences (株式会社TEST / TEST2 / TEST3 / 副業先株式会社)
DELETE FROM ow_experiences WHERE id IN (
  'a712a9e9-6496-49dc-a500-943d06c0609b', -- 株式会社TEST
  'af624ef8-227e-4364-a1f4-1e49fe4139df', -- 株式会社TEST2
  '8a959a8b-b9c8-47ef-b242-1ce3635bd659', -- 株式会社TEST3
  '0c57e7a1-46f8-4471-94dc-3413380ebe86'  -- 副業先株式会社
);

-- 2. Test achievement (あああああ)
DELETE FROM ow_user_achievements WHERE id = '65bce5f7-7f1f-45a9-9c63-97fc65990e67';

-- 3. Test education (朝霞 / 高校卒)
DELETE FROM ow_user_educations WHERE id = '2b645d00-c4e5-4b5b-a9eb-f416269dc142';

-- 4. Test company (株式会社TEST — is_published=false, 0 FK references)
DELETE FROM ow_companies WHERE id = '4039a638-229d-421c-b8be-c2835bf0b9c7';
