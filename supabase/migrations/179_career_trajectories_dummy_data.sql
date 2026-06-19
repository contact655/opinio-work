-- Migration 179: キャリア軌跡ダミーデータ充実
-- 小松耕野（5社）・生藤弘樹（3社）の経歴に salary_man + visibility + join_reason を設定
-- ow_career_profiles に is_published=true で登録

-- ────────────────────────────────────────────────────────────
-- 小松 耕野 — 5社 全件実名公開・年収公開
-- アサヒビール → Salesforce SDR → Salesforce AE → New Relic → フライル
-- ────────────────────────────────────────────────────────────

-- アサヒビール（1社目）
UPDATE ow_experiences SET
  visibility_company = 'real',
  salary_man         = 310,
  visibility_salary  = true,
  visibility_reason  = true,
  join_reason        = '新卒で大手消費財メーカーに入社。大阪・東京・仙台と転勤しながら法人営業の基礎を叩き込まれた。数字を追う習慣はここで身についた。',
  employment_type    = '正社員',
  display_order      = 5
WHERE id = 'd26fd64b-9470-49de-9bec-82a5c685a701';

-- セールスフォース SDR/BDR（2社目）
UPDATE ow_experiences SET
  visibility_company = 'real',
  salary_man         = 460,
  visibility_salary  = true,
  visibility_reason  = true,
  join_reason        = 'コロナ禍でデジタル化が加速するなか、テクノロジーを売ることへの興味が抑えられなくなった。メーカー営業の経験を活かしてSaaSのSDRへ未経験転職。',
  employment_type    = '正社員',
  display_order      = 4
WHERE id = 'd7ac148c-9e7a-4373-9d02-0b0b70aa20bb';

-- セールスフォース AE コマーシャル（3社目・内部昇格）
UPDATE ow_experiences SET
  visibility_company = 'real',
  salary_man         = 680,
  visibility_salary  = true,
  visibility_reason  = true,
  join_reason        = 'SDRとして1年半で内部昇格。担当顧客が中堅企業から大手へ広がり、エンタープライズ営業の醍醐味を覚え始めた時期。',
  employment_type    = '正社員',
  display_order      = 3
WHERE id = 'cea161cf-22c9-4d5b-970e-e50233a60b18';

-- New Relic AE（4社目）
UPDATE ow_experiences SET
  visibility_company = 'real',
  salary_man         = 850,
  visibility_salary  = true,
  visibility_reason  = true,
  join_reason        = 'Salesforceの看板に頼らず「自分の営業力」で勝負したくなった。オブザーバビリティという新しい概念を売ることへの挑戦。',
  employment_type    = '正社員',
  display_order      = 2
WHERE id = '4df83a70-0e95-4fed-96cb-f805dff24b2f';

-- フライル（5社目・現職）
UPDATE ow_experiences SET
  visibility_company = 'real',
  salary_man         = 980,
  visibility_salary  = true,
  visibility_reason  = true,
  join_reason        = 'スタートアップへの転向。事業フェーズが早く、自分でプロセスを作れる環境を選んだ。裁量と報酬のバランスが今のところ一番いい。',
  employment_type    = '正社員',
  display_order      = 1
WHERE id = 'c4aae5e3-23ee-46e2-b351-f6e95bc96f50';

INSERT INTO ow_career_profiles (user_id, headline, years_of_experience, is_published)
VALUES (
  'fb930cf4-4342-4cc6-8ef7-7f0dff90edd1',
  '消費財→外資SaaS→スタートアップ。8年で5社、営業キャリアの変遷',
  8,
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  headline            = EXCLUDED.headline,
  years_of_experience = EXCLUDED.years_of_experience,
  is_published        = EXCLUDED.is_published;

-- ────────────────────────────────────────────────────────────
-- 生藤 弘樹 — 3社 実名公開・年収は現職のみ非公開
-- 富士フイルムBI → Salesforce SDR → フライル
-- ────────────────────────────────────────────────────────────

-- 富士フイルムビジネスイノベーション（1社目）
UPDATE ow_experiences SET
  visibility_company = 'real',
  salary_man         = 370,
  visibility_salary  = true,
  visibility_reason  = true,
  join_reason        = '理系出身で技術営業に配属。複合機・業務システムの提案営業を通じて課題ヒアリングと提案のスキルを磨いた。',
  employment_type    = '正社員',
  display_order      = 3
WHERE id = '5b13403c-c68a-42ac-a774-8ceca2d3d7db';

-- セールスフォース SDR（2社目）
UPDATE ow_experiences SET
  visibility_company = 'real',
  salary_man         = 530,
  visibility_salary  = true,
  visibility_reason  = true,
  join_reason        = 'SIer出身のSaaS転職はSDRから入るルートを選んだ。入社3ヶ月でトップSDRになり手応えをつかんだ。',
  employment_type    = '正社員',
  display_order      = 2
WHERE id = 'dddea6da-2d51-4edc-8070-541ab4a4d7d7';

-- フライル（3社目・現職）年収は非公開
UPDATE ow_experiences SET
  visibility_company = 'real',
  salary_man         = 720,
  visibility_salary  = false,
  visibility_reason  = true,
  join_reason        = '30代前半でスタートアップのエンタープライズ営業へ。Salesforceで培った売り方をそのまま活かせる環境に魅力を感じた。',
  employment_type    = '正社員',
  display_order      = 1
WHERE id = '7176c7f0-20e7-4047-9129-b8e2e0d1c2b5';

INSERT INTO ow_career_profiles (user_id, headline, years_of_experience, is_published)
VALUES (
  '0c99e403-7540-4cf9-8bb1-67571af4f2b6',
  'SIer営業から外資SaaSへ。転職2回で年収を2倍近くにした6年間',
  6,
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  headline            = EXCLUDED.headline,
  years_of_experience = EXCLUDED.years_of_experience,
  is_published        = EXCLUDED.is_published;
