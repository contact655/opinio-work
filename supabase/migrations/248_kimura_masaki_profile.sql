-- Migration 248: 木村雅樹さんプロフィール投入（話せる人 第1号）
-- 対象: email = k.masaki0526@gmail.com
-- 公開しない情報: 生年月日・住所・電話番号・年収・顔写真
-- STEP5（ow_companies.is_published = true）は別途手動実行

DO $$
DECLARE
  v_user_id UUID;
BEGIN

-- ── 0. 対象 user_id 取得・検証（2件以上ヒットすれば STRICT がエラーを投げる） ──
SELECT id INTO STRICT v_user_id
FROM ow_users
WHERE email = 'k.masaki0526@gmail.com';

-- ── STEP 2: ow_users プロフィール更新 ────────────────────────────────────────
UPDATE ow_users SET
  catchphrase = '金融・通信の大手アカウントを一貫して担当してきたエンタープライズ営業',
  about_me    = 'みずほ証券→Salesforce（IS→FS）→CTC。証券の資産運用コンサルから、SaaSのインサイド/フィールドセールス、現在は大手SIerで金融機関向けアカウント営業。CRM/SFA中心のSaaS提案から、IT製品・SIサービスの提案販売まで、一貫して大手法人の新規開拓と既存深耕に従事。'
WHERE id = v_user_id;

-- ── STEP 1: ow_experiences 職歴4件 ──────────────────────────────────────────
-- 冪等ガード: display_order × user_id の組み合わせで重複防止

-- レコード1: 伊藤忠テクノソリューションズ（現職 / CTC）
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
  '138ff010-8671-414a-ab06-752d61f50dd7',
  NULL,
  '56771dac-28a1-4f94-adb9-8363812d38b5',
  '金融営業本部 営業第1部 / 法人営業（アカウント営業）',
  '金融営業本部 営業第1部',
  '2025-08-01', NULL, true,
  1, 'メンバー',
  '大手金融機関（メガバンク・信託銀行）向けのアカウント営業。インフラ〜ミドルソフト〜アプリケーション領域のIT製品（HW/SW）・SIサービスの提案販売から構築・保守・運用まで幅広く従事。既存深耕70%／新規開拓30%。',
  'real', 'real', false, false
WHERE NOT EXISTS (
  SELECT 1 FROM ow_experiences WHERE user_id = v_user_id AND display_order = 1
);

-- レコード2: セールスフォース・ジャパン（フィールドセールス / AE）
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
  'c3664ef1-5571-4645-b30f-1474e7961c17',
  NULL,
  '8db26a6b-e3c8-4b17-9a8a-5d306eb80b33',
  'エンタープライズコーポレートセールス本部 / フィールドセールス（AE）',
  'エンタープライズコーポレートセールス本部',
  '2021-11-01', '2025-07-31', false,
  2, 'メンバー',
  '大手通信事業グループ向けに自社SaaS製品の商談創出から成約・活用支援を担当。新規提案＋既存アップセル/クロスセル。FY26 Q1 達成率進捗105%。',
  'real', 'real', false, false
WHERE NOT EXISTS (
  SELECT 1 FROM ow_experiences WHERE user_id = v_user_id AND display_order = 2
);

-- レコード3: セールスフォース・ジャパン（インサイドセールス / SDR・BDR）
-- ※レコード2と在籍期間同一。display_order で順序制御。
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
  'c3664ef1-5571-4645-b30f-1474e7961c17',
  NULL,
  'd1724303-7ca2-4cbe-a16b-f15d5a2476b8',
  'インサイドセールス（SDR / BDR）',
  NULL,
  '2021-11-01', '2025-07-31', false,
  3, 'メンバー',
  'CRM製品中心の提案活動。SDR（中小企業）で新規開拓、BDR（大手企業）で既存深耕＋新規。実績: Top Performance Club（2022年8月、全国140名で達成率No.1）、FY23Q3 MVP、BDR西日本1位/6ヶ月平均達成率180%、9ヶ月連続100%達成。',
  'real', 'real', false, false
WHERE NOT EXISTS (
  SELECT 1 FROM ow_experiences WHERE user_id = v_user_id AND display_order = 3
);

-- レコード4: みずほ証券株式会社（マスタ未登録のためテキスト保持）
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
  NULL,
  'みずほ証券株式会社',
  '6938712f-0b29-4682-ac6e-ad112734a3f1',
  '兵庫県明石店 ウェルスマネジメント課 / 法人・個人営業',
  '兵庫県明石店 ウェルスマネジメント課',
  '2017-04-01', '2021-10-31', false,
  4, 'メンバー/主任',
  '富裕層個人・法人向けの資産運用コンサルティング（株式/投信/債券/保険）。新規開拓70%／既存深耕30%。2019年度支店2位、2020年度支店1位（支店MVP）。職務階級別コンクール 全国3〜5位（約1,000名中）複数回。',
  'real', 'real', false, false
WHERE NOT EXISTS (
  SELECT 1 FROM ow_experiences WHERE user_id = v_user_id AND display_order = 4
);

-- ── STEP 3a: 資格（ow_user_certifications） ──────────────────────────────────
-- 冪等ガード: ユーザーの資格が1件もない場合のみ一括挿入
INSERT INTO ow_user_certifications (id, user_id, name, sort_order, created_at)
SELECT * FROM (VALUES
  (gen_random_uuid(), v_user_id, '証券外務員一種（2016年11月）',                  1, now()),
  (gen_random_uuid(), v_user_id, 'FP2級・AFP（2018年6月）',                       2, now()),
  (gen_random_uuid(), v_user_id, '生命保険販売資格 一般（2018年8月）',             3, now()),
  (gen_random_uuid(), v_user_id, '生命保険販売資格 専門・変額（2018年9月）',       4, now()),
  (gen_random_uuid(), v_user_id, 'Salesforce認定アドミニストレーター（2024年9月）', 5, now()),
  (gen_random_uuid(), v_user_id, '普通自動車第一種免許（2013年8月）',              6, now())
) AS t(id, user_id, name, sort_order, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_certifications WHERE user_id = v_user_id
);

-- ── STEP 3b: スキルタグ（ow_user_skill_tags） ────────────────────────────────
INSERT INTO ow_user_skill_tags (id, user_id, label, sort_order, created_at)
SELECT * FROM (VALUES
  (gen_random_uuid(), v_user_id, 'Salesforce',               1, now()),
  (gen_random_uuid(), v_user_id, 'エンタープライズ営業',       2, now()),
  (gen_random_uuid(), v_user_id, 'インサイドセールス',         3, now()),
  (gen_random_uuid(), v_user_id, 'Slack',                    4, now()),
  (gen_random_uuid(), v_user_id, 'Tableau',                  5, now()),
  (gen_random_uuid(), v_user_id, 'Microsoft 365',            6, now()),
  (gen_random_uuid(), v_user_id, '英語（ビジネス読解・米国本社対応）', 7, now())
) AS t(id, user_id, label, sort_order, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_skill_tags WHERE user_id = v_user_id
);

-- ── STEP 3c: 学歴（ow_user_educations） ──────────────────────────────────────
INSERT INTO ow_user_educations (id, user_id, school, faculty, degree, enrolled_at, graduated_at, is_current, sort_order, created_at)
SELECT * FROM (VALUES
  (gen_random_uuid(), v_user_id, '京都産業大学', '経営学部', '学士', '2013-04-01'::date, '2017-03-31'::date, false, 1, now())
) AS t(id, user_id, school, faculty, degree, enrolled_at, graduated_at, is_current, sort_order, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM ow_user_educations WHERE user_id = v_user_id
);

-- ── STEP 4: ow_company_members（CTC紐付け / 公開の要） ───────────────────────
INSERT INTO ow_company_members (
  id, company_id, user_id,
  display_consent, is_public, consent_at,
  role_title, invite_token, talk_themes
)
SELECT
  gen_random_uuid(),
  '138ff010-8671-414a-ab06-752d61f50dd7',
  v_user_id,
  true, true, now(),
  '金融営業本部 営業第1部',
  gen_random_uuid(),
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM ow_company_members
  WHERE company_id = '138ff010-8671-414a-ab06-752d61f50dd7'
  AND   user_id    = v_user_id
);

END $$;

-- ── 投入確認クエリ（migration 後に手動で実行して確認） ────────────────────────
-- SELECT 'experiences' AS tbl, COUNT(*) FROM ow_experiences WHERE user_id = 'b51fc35e-776a-425e-876f-dcb2005c4389'
-- UNION ALL SELECT 'company_members', COUNT(*) FROM ow_company_members WHERE user_id = 'b51fc35e-776a-425e-876f-dcb2005c4389'
-- UNION ALL SELECT 'certifications',  COUNT(*) FROM ow_user_certifications WHERE user_id = 'b51fc35e-776a-425e-876f-dcb2005c4389'
-- UNION ALL SELECT 'skill_tags',      COUNT(*) FROM ow_user_skill_tags WHERE user_id = 'b51fc35e-776a-425e-876f-dcb2005c4389'
-- UNION ALL SELECT 'educations',      COUNT(*) FROM ow_user_educations WHERE user_id = 'b51fc35e-776a-425e-876f-dcb2005c4389';

-- ── STEP 5（確認後に別途手動実行） ───────────────────────────────────────────
-- UPDATE ow_companies SET is_published = true WHERE id = '138ff010-8671-414a-ab06-752d61f50dd7';
