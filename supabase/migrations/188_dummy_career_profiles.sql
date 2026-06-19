-- ============================================================
-- Migration 188: Dummy career trajectory profiles for UI display
-- ============================================================
-- 8件のダミープロフィール（性別・職種・キャリアパス多様化）
-- auth.users なし (auth_id = null) — 表示専用
--
-- XOR制約: company_id / company_text / company_anonymized のうち
--           厳密に1つだけ非 null であること
--   real + DB企業あり  → company_id のみ（他2列 null）
--   real + フリーテキスト → company_text のみ（他2列 null）
--   masked / hidden    → company_anonymized のみ（他2列 null）
-- ============================================================

DO $$
DECLARE
  u1 uuid := 'c0000001-cafe-babe-dead-000000000001';
  u2 uuid := 'c0000002-cafe-babe-dead-000000000002';
  u3 uuid := 'c0000003-cafe-babe-dead-000000000003';
  u4 uuid := 'c0000004-cafe-babe-dead-000000000004';
  u5 uuid := 'c0000005-cafe-babe-dead-000000000005';
  u6 uuid := 'c0000006-cafe-babe-dead-000000000006';
  u7 uuid := 'c0000007-cafe-babe-dead-000000000007';
  u8 uuid := 'c0000008-cafe-babe-dead-000000000008';

  c_salesforce  uuid := 'c3664ef1-5571-4645-b30f-1474e7961c17';
  c_hubspot     uuid := 'aaaaaaaa-0001-0001-0001-000000000007';
  c_datadog     uuid := 'a5ffac90-70aa-4242-b867-6d9334317851';
  c_sansan      uuid := '8b9f84b0-b4be-4191-8322-07c6a2e5e91a';
  c_smarthr     uuid := '81aa95dc-2304-4faa-9c4a-f2f5454e8e11';
  c_ubie        uuid := 'fb7397eb-a9c7-4ce3-964a-d7a72159847f';
  c_freee       uuid := 'f98f5d13-c72f-42fa-9c91-ee4647de2793';
  c_layerx      uuid := '17e171bb-f2fa-480d-a4e1-e1382af8e842';
  c_timee       uuid := '2e54ff06-2f4d-420c-9a5c-9a80a85ca55a';
  c_servicenow  uuid := '4df6e844-74d6-4f50-98f9-08468a12f1dc';
  c_zendesk     uuid := 'd6650b18-5ef2-40c9-9938-2adbad70fe2b';
  c_aws         uuid := 'a9de1561-eb91-4ebf-842d-f6d39865b7ef';

  r_sales        uuid := '6938712f-0b29-4682-ac6e-ad112734a3f1';
  r_field_sales  uuid := '133c74c0-e432-4c52-8235-7ad9bc7d96b8';
  r_inside_sales uuid := 'd1724303-7ca2-4cbe-a16b-f15d5a2476b8';
  r_cs           uuid := 'ad47e554-e328-4aec-abd1-dab9953ddf9d';
  r_marketing    uuid := '38429140-f784-44c0-8eec-407495044272';
  r_engineer     uuid := 'c8140123-e29a-43b3-9dbf-1a3d21a68966';
  r_sre          uuid := 'ebf63b17-9317-4909-ac5a-ffcee40ce091';
  r_pm           uuid := '669c6a08-997a-4a3f-b588-762acffacbc4';
  r_corporate    uuid := '23e79605-332b-485d-98c2-d162a491a409';
  r_other        uuid := '2c32c54f-63f2-4672-841e-c838f9a71fac';
BEGIN

  -- ── ow_users ─────────────────────────────────────────────
  INSERT INTO ow_users (id, email, name, visibility)
  VALUES
    (u1, 'dummy-tanaka-misaki@opinio.local',     '田中 美咲',   'public'),
    (u2, 'dummy-yamada-tetsuya@opinio.local',    '山田 哲也',   'public'),
    (u3, 'dummy-suzuki-akari@opinio.local',      '鈴木 あかり', 'public'),
    (u4, 'dummy-sato-kenta@opinio.local',        '佐藤 健太',   'public'),
    (u5, 'dummy-nakamura-yumi@opinio.local',     '中村 由美',   'public'),
    (u6, 'dummy-takahashi-seiichi@opinio.local', '高橋 誠一',   'public'),
    (u7, 'dummy-ito-sakura@opinio.local',        '伊藤 さくら', 'public'),
    (u8, 'dummy-watanabe-masao@opinio.local',    '渡辺 正雄',   'public')
  ON CONFLICT (id) DO NOTHING;

  -- ── ow_career_profiles ───────────────────────────────────
  INSERT INTO ow_career_profiles (user_id, is_published, headline, years_of_experience, gender, birth_year)
  VALUES
    (u1, true, '大手営業からSaaS CSへ。顧客と伴走する仕事の楽しさに気づいた',          5,  '女性', 1998),
    (u2, true, 'コンサルからSaaS営業に転換。現場に戻ってわかった本質',                 13, '男性', 1990),
    (u3, true, '広告代理店からインハウスマーケへ。SaaSで見えたキャリアの可能性',        9,  '女性', 1994),
    (u4, true, '大手SIerからSaaSエンジニア、そしてPdMへ。技術とビジネスの橋渡し役に',   7,  '男性', 1996),
    (u5, true, '人事部門からHR Techへ。現場経験がプロダクト設計に直結している',         16, '女性', 1987),
    (u6, true, '外資系を渡り歩いて気づいた、SaaS営業の醍醐味',                        11, '男性', 1992),
    (u7, true, '第二新卒でSaaS業界へ。異業種からの転身でわかったこと',                 2,  '女性', 2001),
    (u8, true, '40代で金融からフィンテックへ。遅すぎる転職なんてない',                 23, '男性', 1980)
  ON CONFLICT (user_id) DO NOTHING;

  -- ── ow_experiences ───────────────────────────────────────
  -- XOR ルール (厳守):
  --   company_id あり(real+DB)  → company_text=null, company_anonymized=null
  --   company_text あり(real+自由入力) → company_id=null, company_anonymized=null
  --   masked/hidden             → company_anonymized='説明', company_id=null, company_text=null
  -- display_order: 1=現職(最新) / 数が大きいほど古い
  -- MAX_SHOW=3のため4社目(display_order=4)は「+1社」矢印として折りたたまれる
  DELETE FROM ow_experiences
  WHERE user_id IN (u1, u2, u3, u4, u5, u6, u7, u8);

  -- u1: 田中 美咲 — リクルート → Sansan → SmartHR (3社)
  INSERT INTO ow_experiences
    (user_id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, display_order, visibility_company)
  VALUES
    -- real + company_id: company_text=null, company_anonymized=null
    (u1, c_smarthr, null, null, r_cs,    'カスタマーサクセスリーダー', '2024-03-01', null,         true,  1, 'real'),
    (u1, c_sansan,  null, null, r_cs,    'カスタマーサクセス',        '2022-04-01', '2024-02-28', false, 2, 'real'),
    -- real + company_text: company_id=null, company_anonymized=null
    (u1, null, 'リクルート', null, r_sales, '法人営業', '2020-04-01', '2022-03-31', false, 3, 'real');

  -- u2: 山田 哲也 — 日本IBM(+1社) → アクセンチュア → Salesforce → HubSpot (4社)
  INSERT INTO ow_experiences
    (user_id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, display_order, visibility_company)
  VALUES
    (u2, c_hubspot,    null, null, r_field_sales, 'シニア アカウントエグゼクティブ', '2023-04-01', null,         true,  1, 'real'),
    (u2, c_salesforce, null, null, r_field_sales, 'エンタープライズAE',              '2018-10-01', '2023-03-31', false, 2, 'real'),
    (u2, null, 'アクセンチュア', null, r_other, 'シニアコンサルタント', '2015-04-01', '2018-09-30', false, 3, 'real'),
    -- 4社目 → +1社 チップに折りたたまれる
    (u2, null, '日本IBM', null, r_other, 'ITコンサルタント', '2012-04-01', '2015-03-31', false, 4, 'real');

  -- u3: 鈴木 あかり — 電通デジタル → HubSpot → Sansan (3社)
  INSERT INTO ow_experiences
    (user_id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, display_order, visibility_company)
  VALUES
    (u3, c_sansan,  null, null, r_marketing, 'マーケティングマネージャー',   '2023-06-01', null,         true,  1, 'real'),
    (u3, c_hubspot, null, null, r_marketing, 'マーケティングスペシャリスト', '2020-09-01', '2023-05-31', false, 2, 'real'),
    (u3, null, '電通デジタル', null, r_marketing, 'デジタルマーケター', '2016-04-01', '2020-08-31', false, 3, 'real');

  -- u4: 佐藤 健太 — NTTデータ(+1社) → AWS → Datadog → Ubie (4社)
  INSERT INTO ow_experiences
    (user_id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, display_order, visibility_company)
  VALUES
    (u4, c_ubie,    null, null, r_pm,       'プロダクトマネージャー', '2024-01-01', null,         true,  1, 'real'),
    (u4, c_datadog, null, null, r_engineer, 'ソフトウェアエンジニア', '2021-07-01', '2023-12-31', false, 2, 'real'),
    (u4, c_aws,     null, null, r_sre,      'クラウドエンジニア',     '2019-04-01', '2021-06-30', false, 3, 'real'),
    -- 4社目 → +1社
    (u4, null, 'NTTデータ', null, r_engineer, 'システムエンジニア', '2018-04-01', '2019-03-31', false, 4, 'real');

  -- u5: 中村 由美 — 大手メーカー(masked,+1社) → パーソル → SmartHR → freee (4社)
  INSERT INTO ow_experiences
    (user_id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, display_order, visibility_company)
  VALUES
    (u5, c_freee,   null, null, r_corporate, 'People & Culture Manager', '2022-04-01', null,         true,  1, 'real'),
    (u5, c_smarthr, null, null, r_cs,        'カスタマーサクセス',        '2018-10-01', '2022-03-31', false, 2, 'real'),
    (u5, null, 'パーソル', null, r_corporate, '採用コンサルタント', '2014-04-01', '2018-09-30', false, 3, 'real'),
    -- masked: company_anonymized のみ設定
    (u5, null, null, '大手製造業（非公開）', r_corporate, '人事・採用担当', '2009-04-01', '2014-03-31', false, 4, 'masked');

  -- u6: 高橋 誠一 — ServiceNow → Zendesk → Salesforce (3社・全て外資ロゴ)
  INSERT INTO ow_experiences
    (user_id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, display_order, visibility_company)
  VALUES
    (u6, c_salesforce, null, null, r_field_sales,  'エンタープライズ アカウントエグゼクティブ', '2022-04-01', null,         true,  1, 'real'),
    (u6, c_zendesk,    null, null, r_field_sales,  'アカウントエグゼクティブ',                 '2018-07-01', '2022-03-31', false, 2, 'real'),
    (u6, c_servicenow, null, null, r_inside_sales, 'インサイドセールス',                       '2014-04-01', '2018-06-30', false, 3, 'real');

  -- u7: 伊藤 さくら — 前職masked → Timee (2社)
  INSERT INTO ow_experiences
    (user_id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, display_order, visibility_company)
  VALUES
    (u7, c_timee, null, null, r_cs,    'カスタマーサクセス', '2023-07-01', null,         true,  1, 'real'),
    -- masked: company_anonymized のみ設定
    (u7, null, null, '製造業（非公開）', r_other, '営業・事務', '2022-04-01', '2023-06-30', false, 2, 'masked');

  -- u8: 渡辺 正雄 — 三菱UFJ(+1社) → 野村総研 → freee → LayerX (4社)
  INSERT INTO ow_experiences
    (user_id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, display_order, visibility_company)
  VALUES
    (u8, c_layerx, null, null, r_field_sales, 'エンタープライズ営業', '2022-04-01', null,         true,  1, 'real'),
    (u8, c_freee,  null, null, r_field_sales, 'エンタープライズ営業', '2018-10-01', '2022-03-31', false, 2, 'real'),
    (u8, null, '野村総合研究所', null, r_other, 'ITコンサルタント', '2012-04-01', '2018-09-30', false, 3, 'real'),
    -- 4社目 → +1社
    (u8, null, '三菱UFJ銀行', null, r_other, '法人融資担当', '2002-04-01', '2012-03-31', false, 4, 'real');

END $$;
