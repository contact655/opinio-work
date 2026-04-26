-- ===========================================================
-- Consultation Phase 1 - Seed Data (final)
-- サンプルメンター 3 名 + 各 10 枠の availability
--
-- 実行前提:
--   1. Supabase Dashboard → Authentication → Users で
--      3 ユーザーを作成済み
--   2. 各 user_id を下記 v_tanaka / v_sato / v_suzuki に貼り付け
--
-- 空き枠ポリシー:
--   - 翌日(d=1)から 2 週間(d=14)の範囲
--   - 平日夜 20:00 / 20:30 / 21:00 と、週末午前 10:00-11:00 / 午後 14:00-16:00
--     を分散
--   - 各メンター 10 枠ずつ、時間帯をメンター間でずらす
-- ===========================================================


DO $$
DECLARE
  -- ▼▼ ここに Supabase Auth で作成した各ユーザーの user_id を貼り付け ▼▼
  v_tanaka uuid := '00000000-0000-0000-0000-000000000001'::uuid;  -- 田中翼
  v_sato   uuid := '00000000-0000-0000-0000-000000000002'::uuid;  -- 佐藤結花
  v_suzuki uuid := '00000000-0000-0000-0000-000000000003'::uuid;  -- 鈴木健太
  -- ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  v_approved_at text := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

  -- 各メンターの空き枠定義: JSONB の [{d:day_offset, t:"HH:MM"}, ...]
  -- d は CURRENT_DATE からの日数オフセット
  v_slots_tanaka jsonb := '[
    {"d":1,"t":"20:00"}, {"d":2,"t":"20:00"}, {"d":3,"t":"21:00"},
    {"d":4,"t":"20:00"}, {"d":5,"t":"10:00"}, {"d":6,"t":"14:00"},
    {"d":7,"t":"20:00"}, {"d":9,"t":"21:00"}, {"d":11,"t":"10:00"},
    {"d":13,"t":"14:00"}
  ]'::jsonb;

  v_slots_sato jsonb := '[
    {"d":1,"t":"21:00"}, {"d":3,"t":"20:00"}, {"d":4,"t":"21:00"},
    {"d":5,"t":"15:00"}, {"d":6,"t":"11:00"}, {"d":8,"t":"20:00"},
    {"d":9,"t":"21:00"}, {"d":10,"t":"14:00"}, {"d":12,"t":"11:00"},
    {"d":13,"t":"15:00"}
  ]'::jsonb;

  v_slots_suzuki jsonb := '[
    {"d":2,"t":"21:00"}, {"d":3,"t":"20:30"}, {"d":5,"t":"14:00"},
    {"d":6,"t":"16:00"}, {"d":7,"t":"21:00"}, {"d":9,"t":"20:30"},
    {"d":10,"t":"10:00"}, {"d":11,"t":"14:00"}, {"d":12,"t":"21:00"},
    {"d":14,"t":"16:00"}
  ]'::jsonb;

BEGIN

  -- ========================================================
  -- 1. ow_user_profiles: 3 メンターのプロファイル登録
  -- ========================================================

  -- 田中翼: 元Salesforce FS → freee CS (primary_role_tag: FS)
  INSERT INTO ow_user_profiles (user_id, roles, mentor_profile, current_job_type)
  VALUES (
    v_tanaka,
    '["mentor"]'::jsonb,
    jsonb_build_object(
      'approved_at',        v_approved_at,
      'status',             'active',
      'display_name_short', '田中 翼',
      'primary_role_tag',   'FS',
      'experience_tags',    jsonb_build_array('IS_to_FS', 'FS_to_CS', 'SaaS_sales', 'MidMarket'),
      'career_history',     jsonb_build_array(
                              jsonb_build_object('company', 'Salesforce Japan', 'role', 'FS', 'period', '2018-2022'),
                              jsonb_build_object('company', 'freee',            'role', 'CS', 'period', '2022-')
                            ),
      'bio_short',          'IS出身でFSに上がる時、周りに相談できる人が少なくて迷いました。その時の失敗も含めてお話しします。',
      'avatar_url',         NULL,
      'hourly_rate_yen',    0,
      'max_slots_per_week', 5,
      'notes_internal',     'Phase 1 シード'
    ),
    'FS'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    roles            = EXCLUDED.roles,
    mentor_profile   = EXCLUDED.mentor_profile,
    current_job_type = EXCLUDED.current_job_type;

  -- 佐藤結花: 元SmartHR IS → 某社ISマネージャー (primary_role_tag: IS)
  INSERT INTO ow_user_profiles (user_id, roles, mentor_profile, current_job_type)
  VALUES (
    v_sato,
    '["mentor"]'::jsonb,
    jsonb_build_object(
      'approved_at',        v_approved_at,
      'status',             'active',
      'display_name_short', '佐藤 結花',
      'primary_role_tag',   'IS',
      'experience_tags',    jsonb_build_array('IS_experience', 'manager_pivot', 'SaaS_sales', 'SMB'),
      'career_history',     jsonb_build_array(
                              jsonb_build_object('company', 'SmartHR', 'role', 'IS',            'period', '2019-2023'),
                              jsonb_build_object('company', '某社',     'role', 'ISマネージャー', 'period', '2023-')
                            ),
      'bio_short',          'ISとして3年、マネージャーになって2年。ISのキャリアに迷っている方の相談に乗れます。',
      'avatar_url',         NULL,
      'hourly_rate_yen',    0,
      'max_slots_per_week', 5,
      'notes_internal',     'Phase 1 シード'
    ),
    'IS'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    roles            = EXCLUDED.roles,
    mentor_profile   = EXCLUDED.mentor_profile,
    current_job_type = EXCLUDED.current_job_type;

  -- 鈴木健太: 元Sansan FS → 某社BizDev (primary_role_tag: BizDev)
  INSERT INTO ow_user_profiles (user_id, roles, mentor_profile, current_job_type)
  VALUES (
    v_suzuki,
    '["mentor"]'::jsonb,
    jsonb_build_object(
      'approved_at',        v_approved_at,
      'status',             'active',
      'display_name_short', '鈴木 健太',
      'primary_role_tag',   'BizDev',
      'experience_tags',    jsonb_build_array('FS_to_CS', 'BizDev_transition', 'enterprise_to_startup', 'SaaS_sales', 'Enterprise'),
      'career_history',     jsonb_build_array(
                              jsonb_build_object('company', 'Sansan', 'role', 'FS',     'period', '2017-2022'),
                              jsonb_build_object('company', '某社',    'role', 'BizDev', 'period', '2022-')
                            ),
      'bio_short',          '大手SaaSからスタートアップに転じてBizDevに挑戦。キャリアの方向転換を考えている方へ。',
      'avatar_url',         NULL,
      'hourly_rate_yen',    0,
      'max_slots_per_week', 5,
      'notes_internal',     'Phase 1 シード'
    ),
    'BizDev'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    roles            = EXCLUDED.roles,
    mentor_profile   = EXCLUDED.mentor_profile,
    current_job_type = EXCLUDED.current_job_type;


  -- ========================================================
  -- 2. ow_mentor_availability: 各メンター 10 枠ずつ
  --    JSONB 定義を展開して INSERT
  --    各枠は 15 分間 (slot_end = slot_start + 15 minutes)
  -- ========================================================

  INSERT INTO ow_mentor_availability (mentor_user_id, slot_start_at, slot_end_at)
  SELECT
    v_tanaka,
    (((CURRENT_DATE + (s->>'d')::int)::text) || ' ' || (s->>'t') || ':00+09')::timestamptz,
    (((CURRENT_DATE + (s->>'d')::int)::text) || ' ' || (s->>'t') || ':00+09')::timestamptz + interval '15 minutes'
  FROM jsonb_array_elements(v_slots_tanaka) AS s;

  INSERT INTO ow_mentor_availability (mentor_user_id, slot_start_at, slot_end_at)
  SELECT
    v_sato,
    (((CURRENT_DATE + (s->>'d')::int)::text) || ' ' || (s->>'t') || ':00+09')::timestamptz,
    (((CURRENT_DATE + (s->>'d')::int)::text) || ' ' || (s->>'t') || ':00+09')::timestamptz + interval '15 minutes'
  FROM jsonb_array_elements(v_slots_sato) AS s;

  INSERT INTO ow_mentor_availability (mentor_user_id, slot_start_at, slot_end_at)
  SELECT
    v_suzuki,
    (((CURRENT_DATE + (s->>'d')::int)::text) || ' ' || (s->>'t') || ':00+09')::timestamptz,
    (((CURRENT_DATE + (s->>'d')::int)::text) || ' ' || (s->>'t') || ':00+09')::timestamptz + interval '15 minutes'
  FROM jsonb_array_elements(v_slots_suzuki) AS s;

  RAISE NOTICE 'Seed completed: 3 mentors + 30 availability slots';
END $$;


-- ===========================================================
-- 確認クエリ (実行後に貼って検証)
-- ===========================================================

-- 1. メンター3名の登録確認
-- SELECT
--   mentor_profile->>'display_name_short' AS name,
--   mentor_profile->>'primary_role_tag'   AS role,
--   mentor_profile->'experience_tags'     AS tags
-- FROM ow_user_profiles
-- WHERE roles @> '["mentor"]'::jsonb
-- ORDER BY mentor_profile->>'display_name_short';

-- 2. 各メンターの空き枠の分布確認
-- SELECT
--   p.mentor_profile->>'display_name_short' AS name,
--   COUNT(a.id) AS slot_count,
--   to_char(MIN(a.slot_start_at AT TIME ZONE 'Asia/Tokyo'), 'MM/DD(Dy) HH24:MI') AS first_slot_jst,
--   to_char(MAX(a.slot_start_at AT TIME ZONE 'Asia/Tokyo'), 'MM/DD(Dy) HH24:MI') AS last_slot_jst
-- FROM ow_user_profiles p
-- LEFT JOIN ow_mentor_availability a ON a.mentor_user_id = p.user_id
-- WHERE p.roles @> '["mentor"]'::jsonb
-- GROUP BY p.user_id, p.mentor_profile->>'display_name_short'
-- ORDER BY name;

-- 3. 全スロット一覧(JST で見る)
-- SELECT
--   p.mentor_profile->>'display_name_short' AS name,
--   to_char(a.slot_start_at AT TIME ZONE 'Asia/Tokyo', 'MM/DD(Dy) HH24:MI') AS slot_jst,
--   a.status
-- FROM ow_mentor_availability a
-- JOIN ow_user_profiles p ON p.user_id = a.mentor_user_id
-- ORDER BY a.slot_start_at;
