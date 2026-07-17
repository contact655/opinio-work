-- Migration 253: 高校4校を ow_schools に登録 + 4名の ow_user_educations に高校 education を追加
-- type = 'highschool'（ow_schools_type_check の既存許可値; 'highschool' は不可）
-- 対象:
--   木村雅樹  (k.masaki0526@gmail.com)   → 滋賀県立東大津高等学校
--   大塚悠貴  (g8227086@icloud.com)      → 埼玉県立朝霞西高等学校
--   福永陽貴  (3966fh830@gmail.com)      → 徳島県立城東高等学校
--   生藤弘樹  (contact+001@opinio.co.jp) → 滝川第二高等学校
-- 既存の大学 education・experience・他ユーザーは触らない。追加のみ。
-- EXCEPTION 握りつぶし禁止。

DO $$
DECLARE
  v_uid_kimura    UUID;
  v_uid_otsuka    UUID;
  v_uid_fukunaga  UUID;
  v_uid_ikifuji   UUID;

  v_sid_higashiotsu  UUID;
  v_sid_asaka        UUID;
  v_sid_johto        UUID;
  v_sid_takigawa     UUID;
BEGIN

-- ──────────────────────────────────────────────────────────────────
-- STEP 1: user_id 取得（0件/2件以上で STRICT がエラー → 握りつぶし禁止）
-- ──────────────────────────────────────────────────────────────────
SELECT id INTO STRICT v_uid_kimura
  FROM ow_users WHERE email = 'k.masaki0526@gmail.com';

SELECT id INTO STRICT v_uid_otsuka
  FROM ow_users WHERE email = 'g8227086@icloud.com';

SELECT id INTO STRICT v_uid_fukunaga
  FROM ow_users WHERE email = '3966fh830@gmail.com';

SELECT id INTO STRICT v_uid_ikifuji
  FROM ow_users WHERE email = 'contact+001@opinio.co.jp';

-- ──────────────────────────────────────────────────────────────────
-- STEP 2: 高校マスタを ow_schools に登録（NOT EXISTS で冪等）
-- ──────────────────────────────────────────────────────────────────

-- 滋賀県立東大津高等学校
INSERT INTO ow_schools (id, name, name_kana, logo_url, logo_gradient, logo_letter, country, type)
SELECT
  gen_random_uuid(),
  '滋賀県立東大津高等学校',
  'しがけんりつひがしおおつこうとうがっこう',
  NULL,
  'linear-gradient(135deg, #14532D, #15803D)',
  '東',
  'JP',
  'highschool'
WHERE NOT EXISTS (
  SELECT 1 FROM ow_schools WHERE name = '滋賀県立東大津高等学校'
);

-- 埼玉県立朝霞西高等学校
INSERT INTO ow_schools (id, name, name_kana, logo_url, logo_gradient, logo_letter, country, type)
SELECT
  gen_random_uuid(),
  '埼玉県立朝霞西高等学校',
  'さいたまけんりつあさかにしこうとうがっこう',
  NULL,
  'linear-gradient(135deg, #1E3A5F, #2563EB)',
  '朝',
  'JP',
  'highschool'
WHERE NOT EXISTS (
  SELECT 1 FROM ow_schools WHERE name = '埼玉県立朝霞西高等学校'
);

-- 徳島県立城東高等学校
INSERT INTO ow_schools (id, name, name_kana, logo_url, logo_gradient, logo_letter, country, type)
SELECT
  gen_random_uuid(),
  '徳島県立城東高等学校',
  'とくしまけんりつじょうとうこうとうがっこう',
  NULL,
  'linear-gradient(135deg, #312E81, #4338CA)',
  '城',
  'JP',
  'highschool'
WHERE NOT EXISTS (
  SELECT 1 FROM ow_schools WHERE name = '徳島県立城東高等学校'
);

-- 滝川第二高等学校
INSERT INTO ow_schools (id, name, name_kana, logo_url, logo_gradient, logo_letter, country, type)
SELECT
  gen_random_uuid(),
  '滝川第二高等学校',
  'たきがわだいにこうとうがっこう',
  NULL,
  'linear-gradient(135deg, #7F1D1D, #DC2626)',
  '滝',
  'JP',
  'highschool'
WHERE NOT EXISTS (
  SELECT 1 FROM ow_schools WHERE name = '滝川第二高等学校'
);

-- ──────────────────────────────────────────────────────────────────
-- STEP 3: 登録した高校の id を取得
-- ──────────────────────────────────────────────────────────────────
SELECT id INTO STRICT v_sid_higashiotsu
  FROM ow_schools WHERE name = '滋賀県立東大津高等学校';

SELECT id INTO STRICT v_sid_asaka
  FROM ow_schools WHERE name = '埼玉県立朝霞西高等学校';

SELECT id INTO STRICT v_sid_johto
  FROM ow_schools WHERE name = '徳島県立城東高等学校';

SELECT id INTO STRICT v_sid_takigawa
  FROM ow_schools WHERE name = '滝川第二高等学校';

-- ──────────────────────────────────────────────────────────────────
-- STEP 4: ow_user_educations に高校 education を INSERT
-- sort_order=2（大学が sort_order=1）
-- 重複ガード: (user_id, school) の組み合わせで NOT EXISTS
-- ──────────────────────────────────────────────────────────────────

-- 木村雅樹 → 滋賀県立東大津高等学校
INSERT INTO ow_user_educations (
  id, user_id, school, school_id, faculty, degree,
  enrolled_at, graduated_at, is_current, sort_order, created_at
)
SELECT
  gen_random_uuid(),
  v_uid_kimura,
  '滋賀県立東大津高等学校',
  v_sid_higashiotsu,
  NULL,
  '高校卒',
  '2010-04-01'::date,
  '2013-03-31'::date,
  false,
  2,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_educations
  WHERE user_id = v_uid_kimura AND school = '滋賀県立東大津高等学校'
);

-- 大塚悠貴 → 埼玉県立朝霞西高等学校
INSERT INTO ow_user_educations (
  id, user_id, school, school_id, faculty, degree,
  enrolled_at, graduated_at, is_current, sort_order, created_at
)
SELECT
  gen_random_uuid(),
  v_uid_otsuka,
  '埼玉県立朝霞西高等学校',
  v_sid_asaka,
  NULL,
  '高校卒',
  '2005-04-01'::date,
  '2008-03-31'::date,
  false,
  2,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_educations
  WHERE user_id = v_uid_otsuka AND school = '埼玉県立朝霞西高等学校'
);

-- 福永陽貴 → 徳島県立城東高等学校
INSERT INTO ow_user_educations (
  id, user_id, school, school_id, faculty, degree,
  enrolled_at, graduated_at, is_current, sort_order, created_at
)
SELECT
  gen_random_uuid(),
  v_uid_fukunaga,
  '徳島県立城東高等学校',
  v_sid_johto,
  NULL,
  '高校卒',
  '2017-04-01'::date,
  '2020-03-31'::date,
  false,
  2,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_educations
  WHERE user_id = v_uid_fukunaga AND school = '徳島県立城東高等学校'
);

-- 生藤弘樹 → 滝川第二高等学校
INSERT INTO ow_user_educations (
  id, user_id, school, school_id, faculty, degree,
  enrolled_at, graduated_at, is_current, sort_order, created_at
)
SELECT
  gen_random_uuid(),
  v_uid_ikifuji,
  '滝川第二高等学校',
  v_sid_takigawa,
  NULL,
  '高校卒',
  '2012-04-01'::date,
  '2015-03-31'::date,
  false,
  2,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_educations
  WHERE user_id = v_uid_ikifuji AND school = '滝川第二高等学校'
);

END $$;

-- ── 確認クエリ（実行後に照合） ───────────────────────────────────────
-- SELECT u.email, u.name, e.school, e.school_id, s.name AS school_master_name,
--        e.degree, e.enrolled_at, e.graduated_at, e.sort_order
-- FROM ow_user_educations e
-- JOIN ow_users u ON u.id = e.user_id
-- LEFT JOIN ow_schools s ON s.id = e.school_id
-- WHERE u.email IN (
--   'k.masaki0526@gmail.com',
--   'g8227086@icloud.com',
--   '3966fh830@gmail.com',
--   'contact+001@opinio.co.jp'
-- )
-- ORDER BY u.email, e.sort_order;
-- 期待値: 4名それぞれ 大学(sort_order=1)+高校(sort_order=2) の2行
--         高校行は school_id IS NOT NULL かつ school_master_name が高校名に一致
