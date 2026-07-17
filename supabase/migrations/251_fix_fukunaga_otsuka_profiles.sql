-- Migration 251: 福永陽貴・大塚悠貴 プロフィール差分補完（A案: スタブUPDATE + 不足INSERT）
-- 対象: 3966fh830@gmail.com（福永） / g8227086@icloud.com（大塚）
-- 方針: profile/edit で入力された不完全スタブ(display_order=0)を完成形にUPDATE。
--       不足レコードのみINSERT。既存の正常データ(display_order>=1)は触らない。
-- 公開しない情報: 生年月日・年齢・性別・現住所・電話番号・個人メール・顔写真・扶養家族・年収
-- EXCEPTION 握りつぶし禁止。
-- STEP5（is_published = true）は確認後に別途手動実行。

-- ════════════════════════════════════════════════════════════════
-- BLOCK A: 福永陽貴（3966fh830@gmail.com）
--   UPDATE: display_order=0 スタブ → HPE現職 完成形（display_order=1）
--   INSERT: skill_tags(4件), company_members(HPE)
--   ※ certifications(2件)・educations(1件)は既存で正常 → 触らない
-- ════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_user_id    UUID;
  v_company_id UUID;
BEGIN

-- ── 0-A. HPE company_id を名前で解決（ハードコード禁止） ──────────────────────
SELECT id INTO STRICT v_company_id
FROM ow_companies
WHERE name = '日本ヒューレット・パッカード合同会社';

-- ── 0-B. user_id 取得（0件/2件以上でエラー） ──────────────────────────────────
SELECT id INTO STRICT v_user_id
FROM ow_users
WHERE email = '3966fh830@gmail.com';

-- ── STEP 2: ow_users プロフィール更新（べき等） ──────────────────────────────
UPDATE ow_users SET
  catchphrase = '新卒でHPEに入り、静岡エリア中心にインフラ製品のハイタッチセールスとして新規開拓に取り組む',
  about_me    = '東京都立大学都市環境学部卒（2025年3月）後、新卒でヒューレット・パッカード エンタープライズ（HPE）に入社。コンピュート・ストレージ製品やバックアップソリューションの法人向けハイタッチセールスを担当。静岡エリアを中心に準大手〜中小企業の新規開拓と地場ベンダーとの協業に従事。2025年度Q4アクティビティ達成率146%。'
WHERE id = v_user_id;

-- ── STEP 1: display_order=0 スタブを完成形にUPDATE ─────────────────────────
-- ガード: company_id IS NULL のスタブ行のみ対象（完成済みなら0行更新で無害）
UPDATE ow_experiences SET
  company_id              = v_company_id,
  company_text            = NULL,          -- XOR制約: company_id を持つので text は落とす
  role_title              = 'デジタルセールス・コンピュート事業統括本部 / ハイタッチセールス（法人営業）',
  department              = 'デジタルセールス・コンピュート事業統括本部',
  rank                    = 'none',
  started_at              = '2025-04-01',  -- 既存値と同一
  ended_at                = NULL,
  is_current              = true,          -- 既存値と同一
  display_order           = 1,             -- 木村さん規約: 最新現職=1
  description             = 'HPE製品（コンピュート・ストレージ製品、バックアップソリューション）の法人向けハイタッチセールス。準大手〜中小企業を対象に静岡エリア中心に地場ベンダーと協業しながら新規開拓を推進。首都圏準大手金融・静岡の公共/医療/文教/民間を担当。新規70%/既存30%。2025年度Q4アクティビティ達成率146%。',
  visibility_company      = 'real',
  visibility_company_profile = 'real',
  visibility_salary       = false,
  visibility_reason       = false
WHERE user_id     = v_user_id
  AND display_order = 0
  AND company_id  IS NULL;                 -- スタブ判定: company_id 未設定のものだけ

-- ── STEP 3: skill_tags（ラベル単位の重複ガード） ───────────────────────────
INSERT INTO ow_user_skill_tags (id, user_id, label, sort_order, created_at)
SELECT gen_random_uuid(), v_user_id, t.label, t.sort_order, now()
FROM (VALUES
  ('Word',       1),
  ('Excel',      2),
  ('PowerPoint', 3),
  ('法人営業',   4)
) AS t(label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_skill_tags
  WHERE user_id = v_user_id AND label = t.label
);

-- ── STEP 4: company_members（HPE紐付け） ──────────────────────────────────────
INSERT INTO ow_company_members (
  id, company_id, user_id,
  display_consent, is_public, consent_at,
  role_title, invite_token, talk_themes
)
SELECT
  gen_random_uuid(), v_company_id, v_user_id,
  true, true, now(),
  'デジタルセールス・コンピュート事業統括本部',
  gen_random_uuid(), NULL
WHERE NOT EXISTS (
  SELECT 1 FROM ow_company_members
  WHERE company_id = v_company_id AND user_id = v_user_id
);

END $$;

-- ════════════════════════════════════════════════════════════════
-- BLOCK B: 大塚悠貴（g8227086@icloud.com）
--   INSERT: 海光電業 company
--   UPDATE: display_order=0 スタブ → ① 代理店営業 完成形（display_order=3）
--   INSERT: ② 技術営業（display_order=2）、③ 電設資材営業課長（display_order=1）
--   INSERT: certifications(1件), skill_tags(5件), company_members(海光電業)
--   ※ educations(1件)は既存で正常 → 触らない
-- ════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_user_id    UUID;
  v_company_id UUID;
BEGIN

-- ── 0-A. 海光電業株式会社を企業マスタに登録（冪等） ──────────────────────────
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

-- ── 0-B. user_id 取得 ───────────────────────────────────────────────────────
SELECT id INTO STRICT v_user_id
FROM ow_users
WHERE email = 'g8227086@icloud.com';

-- ── STEP 2: ow_users プロフィール更新（べき等） ──────────────────────────────
UPDATE ow_users SET
  catchphrase = '電設資材商社で14年・8年連続予算達成。代理店営業→太陽光技術営業→課長として組織の数字責任を担う',
  about_me    = '海光電業（電設資材専門商社）に新卒入社し、代理店向け法人営業・太陽光発電の技術営業を経て、現在は課長として電設資材の法人営業チームを統括。新人賞・MVP3回・部署発足初年度25件3億円契約・全社最優秀賞（粗利金額賞）3年連続など、一貫してトップラインの成果を出し続けてきた。2020〜2025年度の売上は約1.8倍に拡大。直近2025年度売上20億8,000万円（達成率104%）。'
WHERE id = v_user_id;

-- ── STEP 1a: display_order=0 スタブ → ① 代理店営業 完成形（display_order=3）
-- ガード: company_id IS NULL のスタブ行のみ対象
UPDATE ow_experiences SET
  company_id              = v_company_id,
  company_text            = NULL,          -- XOR制約
  role_category_id        = '133c74c0-e432-4c52-8235-7ad9bc7d96b8', -- フィールドセールス（既存値と同一）
  role_title              = '第二営業部 / 法人営業（代理店営業）',
  department              = '第二営業部',
  rank                    = 'none',
  started_at              = '2012-04-01',  -- 既存値と同一
  ended_at                = '2018-07-01',
  is_current              = false,         -- 既存値と同一
  display_order           = 3,             -- 最古 → 最大
  description             = '電気設備工事会社（サブコン）向け電設資材の代理店・法人営業。担当約30社、年間5億円以上の売上・売掛管理を担当。新人賞（2012年）、MVP3回（2014/2017/2018年）受賞。2017年3月に主任昇格。銅相場を読んだ仕入交渉で付加価値提案を実施。',
  visibility_company      = 'real',
  visibility_company_profile = 'real',
  visibility_salary       = false,
  visibility_reason       = false
WHERE user_id     = v_user_id
  AND display_order = 0
  AND company_id  IS NULL;

-- ── STEP 1b: ② 技術開発本部 技術営業部（display_order=2） ───────────────────
-- ガード: 同ユーザー・同開始日のレコードがなければINSERT
INSERT INTO ow_experiences (
  user_id, company_id, company_text,
  role_category_id, role_title, department,
  started_at, ended_at, is_current,
  display_order, rank, description,
  visibility_company, visibility_company_profile,
  visibility_salary, visibility_reason
)
SELECT
  v_user_id, v_company_id, NULL,
  '05cf4e21-8921-4f42-b9f1-fab9b709eb11', -- セールスエンジニア・プリセールス
  '技術開発本部 技術営業部 / 技術営業',
  '技術開発本部 技術営業部',
  '2018-07-01', '2020-07-01', false,
  2, 'none',
  '再生可能エネルギー（太陽光発電）の技術営業。基本設計・現地調査・諸官庁申請・施工管理を担当。自社独自PV Control Unit販売で30件受注、竣工検査10段階中9.7の高評価。部署発足初年度25件3億円契約、2019年度10億5,000万円（達成率200%）。',
  'real', 'real', false, false
WHERE NOT EXISTS (
  SELECT 1 FROM ow_experiences
  WHERE user_id = v_user_id AND started_at = '2018-07-01'
);

-- ── STEP 1c: ③ 第6営業部 電設資材営業課長（display_order=1 / 最新現職） ──────
INSERT INTO ow_experiences (
  user_id, company_id, company_text,
  role_category_id, role_title, department,
  started_at, ended_at, is_current,
  display_order, rank, description,
  visibility_company, visibility_company_profile,
  visibility_salary, visibility_reason
)
SELECT
  v_user_id, v_company_id, NULL,
  '133c74c0-e432-4c52-8235-7ad9bc7d96b8', -- フィールドセールス
  '第6営業部 / 電設資材営業（課長）',
  '第6営業部',
  '2020-07-01', NULL, true,
  1, 'manager',
  '電線・ケーブル他の電設資材の法人営業。技術営業の経験を活かし案件規模を拡大、2020→2025年度で売上約1.8倍。2022〜2024年度 全社最優秀賞 粗利金額賞3年連続受賞、2025年度全社優秀賞。直近2025年度売上20億8,000万円（達成率104%）。2022年課長代理、2025年課長に昇格。',
  'real', 'real', false, false
WHERE NOT EXISTS (
  SELECT 1 FROM ow_experiences
  WHERE user_id = v_user_id AND started_at = '2020-07-01'
);

-- ── STEP 3a: certifications（name単位の重複ガード） ────────────────────────
INSERT INTO ow_user_certifications (id, user_id, name, sort_order, created_at)
SELECT gen_random_uuid(), v_user_id, t.name, t.sort_order, now()
FROM (VALUES
  ('普通自動車第一種免許', 1)
) AS t(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_certifications
  WHERE user_id = v_user_id AND name = t.name
);

-- ── STEP 3b: skill_tags（ラベル単位の重複ガード） ───────────────────────────
INSERT INTO ow_user_skill_tags (id, user_id, label, sort_order, created_at)
SELECT gen_random_uuid(), v_user_id, t.label, t.sort_order, now()
FROM (VALUES
  ('法人営業',          1),
  ('技術営業',          2),
  ('ソリューション営業', 3),
  ('新規開拓',          4),
  ('KPI設計・進捗管理', 5)
) AS t(label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_skill_tags
  WHERE user_id = v_user_id AND label = t.label
);

-- ── STEP 4: company_members（海光電業紐付け） ─────────────────────────────────
INSERT INTO ow_company_members (
  id, company_id, user_id,
  display_consent, is_public, consent_at,
  role_title, invite_token, talk_themes
)
SELECT
  gen_random_uuid(), v_company_id, v_user_id,
  true, true, now(),
  '第6営業部',
  gen_random_uuid(), NULL
WHERE NOT EXISTS (
  SELECT 1 FROM ow_company_members
  WHERE company_id = v_company_id AND user_id = v_user_id
);

END $$;

-- ════════════════════════════════════════════════════════════════
-- 投入確認クエリ（実行後に手動で実施）
-- ════════════════════════════════════════════════════════════════

-- ── 福永 ──
-- SELECT 'fuku_exp'  AS t, COUNT(*) FROM ow_experiences         WHERE user_id = (SELECT id FROM ow_users WHERE email = '3966fh830@gmail.com')
-- UNION ALL SELECT 'fuku_mem', COUNT(*) FROM ow_company_members   WHERE user_id = (SELECT id FROM ow_users WHERE email = '3966fh830@gmail.com')
-- UNION ALL SELECT 'fuku_cert',COUNT(*) FROM ow_user_certifications WHERE user_id = (SELECT id FROM ow_users WHERE email = '3966fh830@gmail.com')
-- UNION ALL SELECT 'fuku_tag', COUNT(*) FROM ow_user_skill_tags    WHERE user_id = (SELECT id FROM ow_users WHERE email = '3966fh830@gmail.com')
-- UNION ALL SELECT 'fuku_edu', COUNT(*) FROM ow_user_educations    WHERE user_id = (SELECT id FROM ow_users WHERE email = '3966fh830@gmail.com');
-- 期待値: exp=1 / mem=1 / cert=2 / tag=4 / edu=1

-- ── 大塚 ──
-- SELECT 'otsu_exp'  AS t, COUNT(*) FROM ow_experiences         WHERE user_id = (SELECT id FROM ow_users WHERE email = 'g8227086@icloud.com')
-- UNION ALL SELECT 'otsu_mem', COUNT(*) FROM ow_company_members   WHERE user_id = (SELECT id FROM ow_users WHERE email = 'g8227086@icloud.com')
-- UNION ALL SELECT 'otsu_cert',COUNT(*) FROM ow_user_certifications WHERE user_id = (SELECT id FROM ow_users WHERE email = 'g8227086@icloud.com')
-- UNION ALL SELECT 'otsu_tag', COUNT(*) FROM ow_user_skill_tags    WHERE user_id = (SELECT id FROM ow_users WHERE email = 'g8227086@icloud.com')
-- UNION ALL SELECT 'otsu_edu', COUNT(*) FROM ow_user_educations    WHERE user_id = (SELECT id FROM ow_users WHERE email = 'g8227086@icloud.com');
-- 期待値: exp=3 / mem=1 / cert=1 / tag=5 / edu=1

-- ── experience 中身目視（company_id付き・masked残りなし確認） ──
-- SELECT display_order, company_id, company_text, rank, started_at, ended_at, is_current,
--        visibility_company, visibility_company_profile, role_title
-- FROM ow_experiences
-- WHERE user_id IN (SELECT id FROM ow_users WHERE email IN ('3966fh830@gmail.com','g8227086@icloud.com'))
-- ORDER BY user_id, display_order;

-- ════════════════════════════════════════════════════════════════
-- STEP 5（確認後に別途手動実行）
-- ════════════════════════════════════════════════════════════════
-- UPDATE ow_companies SET is_published = true WHERE name = '海光電業株式会社';
-- UPDATE ow_companies SET is_published = true WHERE name = '日本ヒューレット・パッカード合同会社';
