-- Migration 180: ow_career_profiles に年齢・性別を追加 + テーブル権限付与
ALTER TABLE ow_career_profiles
  ADD COLUMN IF NOT EXISTS gender     text,    -- '男性' / '女性' / 'その他' / null=非公開
  ADD COLUMN IF NOT EXISTS birth_year integer; -- 生まれ年（表示時に年齢を算出）

-- anon / authenticated に SELECT 権限を付与（RLS が行レベル制御）
GRANT SELECT ON ow_career_profiles TO anon, authenticated;

-- ダミーデータ更新（小松耕野・生藤弘樹）
UPDATE ow_career_profiles SET gender = '男性', birth_year = 1994
  WHERE user_id = 'fb930cf4-4342-4cc6-8ef7-7f0dff90edd1';

UPDATE ow_career_profiles SET gender = '男性', birth_year = 1991
  WHERE user_id = '0c99e403-7540-4cf9-8bb1-67571af4f2b6';
