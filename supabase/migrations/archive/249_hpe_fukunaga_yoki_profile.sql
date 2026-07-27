-- Migration 249: 日本ヒューレット・パッカード合同会社 企業登録 + 福永陽貴プロフィール投入（話せる人 第2号）
-- 対象: email = '3966fh830@gmail.com'
-- 公開しない情報: 生年月日・年齢・性別・現住所・電話番号・個人メール・顔写真・扶養家族・年収
-- STEP5（ow_companies.is_published = true）は別途手動実行

DO $$
DECLARE
  v_user_id   UUID;
  v_company_id UUID;
BEGIN

-- ── 0-A. 日本ヒューレット・パッカード合同会社 を企業マスタに登録（冪等） ────────
SELECT id INTO v_company_id
FROM ow_companies
WHERE name = '日本ヒューレット・パッカード合同会社'
LIMIT 1;

IF v_company_id IS NULL THEN
  INSERT INTO ow_companies (
    name, name_en, founded_year, founded_at,
    employee_count, location, industry, phase,
    url, description,
    is_published, accepting_casual_meetings,
    is_foreign, source
  )
  VALUES (
    '日本ヒューレット・パッカード合同会社',
    'Hewlett Packard Japan, G.K.',
    1999,
    '1999年7月',
    '約3,000名',
    '東京都江東区',
    'IT・ハードウェア・インフラ',
    '外資系日本法人（非上場）',
    'https://www.hpe.com/jp/ja/',
    'Hewlett Packard Enterprise（HPE）の日本法人。サーバー・ストレージ・ネットワーク等のエンタープライズIT基盤製品を中心に、ハイブリッドクラウド・エッジコンピューティング・セキュリティソリューションを提供。1999年設立、2021年に株式会社から合同会社へ組織変更。資本金10億円。',
    false, false,
    true, 'manual'
  )
  RETURNING id INTO v_company_id;
END IF;

-- ── 0-B. 対象 user_id 取得・検証（0件/2件以上でエラー） ────────────────────────
SELECT id INTO STRICT v_user_id
FROM ow_users
WHERE email = '3966fh830@gmail.com';

-- ── STEP 2: ow_users プロフィール更新 ─────────────────────────────────────────
UPDATE ow_users SET
  catchphrase = '新卒でHPEに入り、静岡エリア中心にインフラ製品のハイタッチセールスとして新規開拓に取り組む',
  about_me    = '東京都立大学都市環境学部卒（2025年3月）後、新卒でヒューレット・パッカード エンタープライズ（HPE）に入社。コンピュート・ストレージ製品やバックアップソリューションの法人向けハイタッチセールスを担当。静岡エリアを中心に準大手〜中小企業の新規開拓と地場ベンダーとの協業に従事。2025年度Q4アクティビティ達成率146%。'
WHERE id = v_user_id;

-- ── STEP 1: ow_experiences 職歴1件 ──────────────────────────────────────────
INSERT INTO ow_experiences (
  user_id, company_id, company_text,
  role_category_id, role_title, department,
  started_at, ended_at, is_current,
  display_order, rank, description,
  visibility_company, visibility_company_profile,
  visibility_salary, visibility_reason
)
SELECT
  v_user_id,
  v_company_id,
  NULL,
  '133c74c0-e432-4c52-8235-7ad9bc7d96b8',
  'デジタルセールス・コンピュート事業統括本部 / ハイタッチセールス（法人営業）',
  'デジタルセールス・コンピュート事業統括本部',
  '2025-04-01', NULL, true,
  1, 'none',
  'HPE製品（コンピュート・ストレージ製品、バックアップソリューション）の法人向けハイタッチセールス。準大手〜中小企業を対象に静岡エリア中心に地場ベンダーと協業しながら新規開拓を推進。首都圏準大手金融・静岡の公共/医療/文教/民間を担当。新規70%/既存30%。2025年度Q4アクティビティ達成率146%。',
  'real', 'real', false, false
WHERE NOT EXISTS (
  SELECT 1 FROM ow_experiences WHERE user_id = v_user_id AND display_order = 1
);

-- ── STEP 3a: 資格（ow_user_certifications） ──────────────────────────────────
INSERT INTO ow_user_certifications (id, user_id, name, sort_order, created_at)
SELECT * FROM (VALUES
  (gen_random_uuid(), v_user_id, 'TOEIC Listening & Reading 815点（2023年1月）', 1, now()),
  (gen_random_uuid(), v_user_id, '普通自動車第一種免許（2024年1月）',             2, now())
) AS t(id, user_id, name, sort_order, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_certifications WHERE user_id = v_user_id
);

-- ── STEP 3b: スキルタグ（ow_user_skill_tags） ────────────────────────────────
INSERT INTO ow_user_skill_tags (id, user_id, label, sort_order, created_at)
SELECT * FROM (VALUES
  (gen_random_uuid(), v_user_id, 'Word',        1, now()),
  (gen_random_uuid(), v_user_id, 'Excel',       2, now()),
  (gen_random_uuid(), v_user_id, 'PowerPoint',  3, now()),
  (gen_random_uuid(), v_user_id, '法人営業',    4, now())
) AS t(id, user_id, label, sort_order, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_skill_tags WHERE user_id = v_user_id
);

-- ── STEP 3c: 学歴（ow_user_educations） ──────────────────────────────────────
INSERT INTO ow_user_educations (
  id, user_id, school, faculty, degree,
  enrolled_at, graduated_at, is_current, sort_order, created_at
)
SELECT * FROM (VALUES
  (gen_random_uuid(), v_user_id,
   '東京都立大学', '都市環境学部 都市基盤環境学科', '学士',
   '2020-04-01'::date, '2025-03-31'::date, false, 1, now())
) AS t(id, user_id, school, faculty, degree, enrolled_at, graduated_at, is_current, sort_order, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_educations WHERE user_id = v_user_id
);

-- ── STEP 4: ow_company_members（HPE紐付け） ──────────────────────────────────
INSERT INTO ow_company_members (
  id, company_id, user_id,
  display_consent, is_public, consent_at,
  role_title, invite_token, talk_themes
)
SELECT
  gen_random_uuid(),
  v_company_id,
  v_user_id,
  true, true, now(),
  'デジタルセールス・コンピュート事業統括本部',
  gen_random_uuid(),
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM ow_company_members
  WHERE company_id = v_company_id
  AND   user_id    = v_user_id
);

END $$;

-- ── 投入確認クエリ（migration 後に手動で実行して確認） ────────────────────────
-- ※ user_id は実行時に取得した値に置き換えること
-- SELECT 'experiences'     AS tbl, COUNT(*) FROM ow_experiences       WHERE user_id = (SELECT id FROM ow_users WHERE email = '3966fh830@gmail.com')
-- UNION ALL
-- SELECT 'company_members' AS tbl, COUNT(*) FROM ow_company_members   WHERE user_id = (SELECT id FROM ow_users WHERE email = '3966fh830@gmail.com')
-- UNION ALL
-- SELECT 'certifications'  AS tbl, COUNT(*) FROM ow_user_certifications WHERE user_id = (SELECT id FROM ow_users WHERE email = '3966fh830@gmail.com')
-- UNION ALL
-- SELECT 'skill_tags'      AS tbl, COUNT(*) FROM ow_user_skill_tags   WHERE user_id = (SELECT id FROM ow_users WHERE email = '3966fh830@gmail.com')
-- UNION ALL
-- SELECT 'educations'      AS tbl, COUNT(*) FROM ow_user_educations   WHERE user_id = (SELECT id FROM ow_users WHERE email = '3966fh830@gmail.com');
-- 期待値: experiences=1 / company_members=1 / certifications=2 / skill_tags=4 / educations=1

-- ── STEP 5（確認後に別途手動実行） ───────────────────────────────────────────
-- UPDATE ow_companies SET is_published = true WHERE name = '日本ヒューレット・パッカード合同会社';
