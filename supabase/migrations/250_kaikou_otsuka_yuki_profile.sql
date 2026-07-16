-- Migration 250: 海光電業株式会社 企業登録 + 大塚悠貴プロフィール投入（話せる人 第3号）
-- 対象: email = 'g8227086@icloud.com'
-- 公開しない情報: 生年月日・年齢・性別・現住所・電話番号・個人メール・顔写真・扶養家族・年収
-- STEP5（ow_companies.is_published = true）は別途手動実行

DO $$
DECLARE
  v_user_id    UUID;
  v_company_id UUID;
BEGIN

-- ── 0-A. 海光電業株式会社 を企業マスタに登録（冪等） ────────────────────────────
SELECT id INTO v_company_id
FROM ow_companies
WHERE name = '海光電業株式会社'
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
    '海光電業株式会社',
    'KAIKOU DENGYO CO.,LTD.',
    1949,
    '1949年3月',
    '259名（2026年1月現在）',
    '東京都渋谷区',
    '電設資材・卸売業',
    '非上場',
    'https://www.kaikou.co.jp/',
    '電線・ケーブルを中心とした電設資材の専門商社。1949年創業、東京都渋谷区恵比寿に本社を置く。電線・受変電設備・照明器具等の電設資材販売に加え、再生可能エネルギー設備の設計・施工、電気設備工事・電気通信工事も手がける。資本金8,000万円。',
    false, false,
    false, 'manual'
  )
  RETURNING id INTO v_company_id;
END IF;

-- ── 0-B. 対象 user_id 取得・検証（0件/2件以上でエラー） ────────────────────────
SELECT id INTO STRICT v_user_id
FROM ow_users
WHERE email = 'g8227086@icloud.com';

-- ── STEP 2: ow_users プロフィール更新 ─────────────────────────────────────────
UPDATE ow_users SET
  catchphrase = '電設資材商社で14年・8年連続予算達成。代理店営業→太陽光技術営業→課長として組織の数字責任を担う',
  about_me    = '海光電業（電設資材専門商社）に新卒入社し、代理店向け法人営業・太陽光発電の技術営業を経て、現在は課長として電設資材の法人営業チームを統括。新人賞・MVP3回・部署発足初年度25件3億円契約・全社最優秀賞（粗利金額賞）3年連続など、一貫してトップラインの成果を出し続けてきた。2020〜2025年度の売上は約1.8倍に拡大。直近2025年度売上20億8,000万円（達成率104%）。'
WHERE id = v_user_id;

-- ── STEP 1: ow_experiences 職歴3件 ──────────────────────────────────────────

-- レコード1（現職）: 第6営業部 電設資材営業（課長）
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
  '第6営業部 / 電設資材営業（課長）',
  '第6営業部',
  '2020-07-01', NULL, true,
  1, 'manager',
  '電線・ケーブル他の電設資材の法人営業。技術営業の経験を活かし案件規模を拡大、2020→2025年度で売上約1.8倍。2022〜2024年度 全社最優秀賞 粗利金額賞3年連続受賞、2025年度全社優秀賞。直近2025年度売上20億8,000万円（達成率104%）。2022年課長代理、2025年課長に昇格。',
  'real', 'real', false, false
WHERE NOT EXISTS (
  SELECT 1 FROM ow_experiences WHERE user_id = v_user_id AND display_order = 1
);

-- レコード2: 技術開発本部 技術営業部（発足メンバー）
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
  '05cf4e21-8921-4f42-b9f1-fab9b709eb11',
  '技術開発本部 技術営業部 / 技術営業',
  '技術開発本部 技術営業部',
  '2018-07-01', '2020-07-01', false,
  2, 'leader',
  '再生可能エネルギー（太陽光発電）の技術営業。基本設計・現地調査・諸官庁申請・施工管理を担当。自社独自PV Control Unit販売で30件受注、竣工検査10段階中9.7の高評価。部署発足初年度25件3億円契約、2019年度10億5,000万円（達成率200%）。',
  'real', 'real', false, false
WHERE NOT EXISTS (
  SELECT 1 FROM ow_experiences WHERE user_id = v_user_id AND display_order = 2
);

-- レコード3: 第二営業部 法人代理店営業
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
  '第二営業部 / 法人営業（代理店営業）',
  '第二営業部',
  '2012-04-01', '2018-07-01', false,
  3, 'none',
  '電気設備工事会社（サブコン）向け電設資材の代理店・法人営業。担当約30社、年間5億円以上の売上・売掛管理を担当。新人賞（2012年）、MVP3回（2014/2017/2018年）受賞。2017年3月に主任昇格。銅相場を読んだ仕入交渉で付加価値提案を実施。',
  'real', 'real', false, false
WHERE NOT EXISTS (
  SELECT 1 FROM ow_experiences WHERE user_id = v_user_id AND display_order = 3
);

-- ── STEP 3a: 資格（ow_user_certifications） ──────────────────────────────────
INSERT INTO ow_user_certifications (id, user_id, name, sort_order, created_at)
SELECT * FROM (VALUES
  (gen_random_uuid(), v_user_id, '普通自動車免許', 1, now())
) AS t(id, user_id, name, sort_order, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_certifications WHERE user_id = v_user_id
);

-- ── STEP 3b: スキルタグ（ow_user_skill_tags） ────────────────────────────────
INSERT INTO ow_user_skill_tags (id, user_id, label, sort_order, created_at)
SELECT * FROM (VALUES
  (gen_random_uuid(), v_user_id, '法人営業',          1, now()),
  (gen_random_uuid(), v_user_id, '技術営業',          2, now()),
  (gen_random_uuid(), v_user_id, 'ソリューション営業', 3, now()),
  (gen_random_uuid(), v_user_id, '新規開拓',          4, now()),
  (gen_random_uuid(), v_user_id, 'KPI設計・進捗管理', 5, now())
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
   '獨協大学', '経済学部 経営学科', '学士',
   '2008-04-01'::date, '2012-03-31'::date, false, 1, now())
) AS t(id, user_id, school, faculty, degree, enrolled_at, graduated_at, is_current, sort_order, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_educations WHERE user_id = v_user_id
);

-- ── STEP 4: ow_company_members（海光電業紐付け） ─────────────────────────────
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
  '第6営業部',
  gen_random_uuid(),
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM ow_company_members
  WHERE company_id = v_company_id
  AND   user_id    = v_user_id
);

END $$;

-- ── 投入確認クエリ（migration 後に手動で実行して確認） ────────────────────────
-- SELECT 'experiences'     AS tbl, COUNT(*) FROM ow_experiences        WHERE user_id = (SELECT id FROM ow_users WHERE email = 'g8227086@icloud.com')
-- UNION ALL
-- SELECT 'company_members' AS tbl, COUNT(*) FROM ow_company_members    WHERE user_id = (SELECT id FROM ow_users WHERE email = 'g8227086@icloud.com')
-- UNION ALL
-- SELECT 'certifications'  AS tbl, COUNT(*) FROM ow_user_certifications WHERE user_id = (SELECT id FROM ow_users WHERE email = 'g8227086@icloud.com')
-- UNION ALL
-- SELECT 'skill_tags'      AS tbl, COUNT(*) FROM ow_user_skill_tags    WHERE user_id = (SELECT id FROM ow_users WHERE email = 'g8227086@icloud.com')
-- UNION ALL
-- SELECT 'educations'      AS tbl, COUNT(*) FROM ow_user_educations    WHERE user_id = (SELECT id FROM ow_users WHERE email = 'g8227086@icloud.com');
-- 期待値: experiences=3 / company_members=1 / certifications=1 / skill_tags=5 / educations=1

-- ── STEP 5（確認後に別途手動実行） ───────────────────────────────────────────
-- UPDATE ow_companies SET is_published = true WHERE name = '海光電業株式会社';
