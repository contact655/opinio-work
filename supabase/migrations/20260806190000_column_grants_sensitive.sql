-- ═══════════════════════════════════════════════════════════════════════════
-- 機微列を authenticated から読めなくする（列単位 GRANT に寄せる）
--
-- ── なぜ（2026-08-06）──────────────────────────────────────────────────────
-- RLS は**行しか判定できない**。「この行は見せるが、この列は隠す」が書けない。
-- 一方 ow_users_login_only_read / ow_experiences_login_only_read は
-- 「ログインしていれば他の登録者の行が見える」設計で、これ自体は妥当
-- （名前・アバターは /people や企業ページで見せる前提）。
-- 問題は**同じ行に email / birth_date / join_reason が同居している**こと。
-- 行設計は変えず、列側で分ける。
--
-- 実測（2026-08-06、ログイン済みトークン）:
--   ow_users              25件（visibility='login_only' の全員）の email / birth_date が返っていた
--   ow_experiences        14件の join_reason が返っていた（visibility_reason=false の8件を含む）
--   ow_career_profiles    公開軌跡の gender / birth_year が返る
--
-- ⚠️ INSERT / UPDATE / DELETE は表レベルのまま残す。本人の編集経路を壊さないため。
-- ⚠️ 列リストは「全列 − 除外列」で作る。anon のリストを流用しない。
--    ow_experiences で anon の19列を流用しようとして department / rank /
--    visibility_company_profile が抜け、/mypage が落ちかけた（同日の教訓）。
-- ⚠️ anon には触らない。anon は元から ow_users / ow_career_profiles を
--    RLS で 0 件に絞れており、ow_experiences は列単位 GRANT 済み。
--
-- ── アプリ側（同一コミットで先に寄せ済み）──────────────────────────────────
--   ow_users.email     → api/biz/members{,/invite}, lib/business/members.ts,
--                        admin/articles（列ごと不要にした）, lib/auth/isAdmin（auth の email に）
--   ow_users.birth_date→ lib/business/meetings.ts（/biz/meetings）, u/[id]
--   ow_experiences.join_reason → u/[id]（visibility_reason の判定は :292 に残す）
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT unnest(ARRAY['ow_users','ow_experiences','ow_career_profiles']) AS t LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                    WHERE table_schema='public' AND table_name=r.t
                      AND grantee='authenticated' AND privilege_type='SELECT')
       AND r.t <> 'ow_experiences' THEN
      RAISE EXCEPTION '% に authenticated の表レベル SELECT が無い。既に適用済み？中止', r.t;
    END IF;
    RAISE NOTICE '適用前 %: 列単位 SELECT % 列', r.t,
      (SELECT count(*) FROM information_schema.column_privileges
        WHERE table_schema='public' AND table_name=r.t AND grantee='authenticated' AND privilege_type='SELECT');
  END LOOP;
END $$;

-- ── ow_users（email / birth_date を除く29列）────────────────────────────────
REVOKE SELECT ON TABLE public.ow_users FROM authenticated;
GRANT SELECT (
  id, auth_id, name, avatar_color, cover_color, about_me, location, social_links,
  is_mentor, mentor_registered_at, mentor_themes, is_active_mentor, visibility,
  created_at, updated_at, future_aspirations, cover_photo_url, avatar_url,
  is_open_to_work, can_casual_meeting, catchphrase, profile_setup_at,
  can_talk_to_candidates, can_talk_to_hr, statistics_opt_out, is_system,
  username, is_test, auth_linked_at
) ON TABLE public.ow_users TO authenticated;

-- ── ow_experiences（年収4列は 20260806170000 で除外済み。join_reason / exit_reason を追加で外す）──
REVOKE SELECT ON TABLE public.ow_experiences FROM authenticated;
GRANT SELECT (
  id, user_id, company_id, company_text, company_anonymized, role_category_id,
  role_title, started_at, ended_at, is_current, description, display_order,
  created_at, updated_at, employment_type,
  visibility_company, visibility_salary, visibility_reason,
  turning_point, rank, visibility_company_profile, department, learnings, department_id
) ON TABLE public.ow_experiences TO authenticated;

-- ── ow_career_profiles（gender / birth_year を除く7列）──────────────────────
REVOKE SELECT ON TABLE public.ow_career_profiles FROM authenticated;
GRANT SELECT (
  id, user_id, headline, years_of_experience, is_published, created_at, updated_at
) ON TABLE public.ow_career_profiles TO authenticated;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_expect jsonb := '{"ow_users":29,"ow_experiences":24,"ow_career_profiles":7}'::jsonb;
  v_drop   jsonb := '{"ow_users":["email","birth_date"],
                      "ow_experiences":["join_reason","exit_reason","salary_man","salary_base","salary_bonus","salary_stock"],
                      "ow_career_profiles":["gender","birth_year"]}'::jsonb;
  r record; v_cols int; v_bad int;
BEGIN
  FOR r IN SELECT unnest(ARRAY['ow_users','ow_experiences','ow_career_profiles']) AS t LOOP
    -- 表レベル SELECT が残っていないこと
    IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
                WHERE table_schema='public' AND table_name=r.t
                  AND grantee='authenticated' AND privilege_type='SELECT') THEN
      RAISE EXCEPTION '% に表レベル SELECT が残っている。ロールバック', r.t;
    END IF;

    -- 除外した列に SELECT が無いこと
    SELECT count(*) INTO v_bad FROM information_schema.column_privileges
     WHERE table_schema='public' AND table_name=r.t AND grantee='authenticated'
       AND privilege_type='SELECT'
       AND column_name IN (SELECT jsonb_array_elements_text(v_drop -> r.t));
    IF v_bad <> 0 THEN RAISE EXCEPTION '% の除外列に SELECT が % 列残っている。ロールバック', r.t, v_bad; END IF;

    -- 残す列数が想定どおりであること
    SELECT count(*) INTO v_cols FROM information_schema.column_privileges
     WHERE table_schema='public' AND table_name=r.t AND grantee='authenticated' AND privilege_type='SELECT';
    IF v_cols <> (v_expect ->> r.t)::int THEN
      RAISE EXCEPTION '% の列単位 SELECT が % 列（想定 %）。ロールバック', r.t, v_cols, (v_expect ->> r.t)::int;
    END IF;

    -- 本人の編集経路（INSERT/UPDATE/DELETE）が残っていること
    IF (SELECT count(*) FROM information_schema.role_table_grants
         WHERE table_schema='public' AND table_name=r.t AND grantee='authenticated'
           AND privilege_type IN ('INSERT','UPDATE','DELETE')) <> 3 THEN
      RAISE EXCEPTION '% の INSERT/UPDATE/DELETE が欠けている。ロールバック', r.t;
    END IF;

    RAISE NOTICE '完了 %: 列単位 SELECT % 列 / 除外列に権限なし / INSERT・UPDATE・DELETE は維持', r.t, v_cols;
  END LOOP;

  -- anon を巻き込んでいないこと
  IF (SELECT count(*) FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name IN ('ow_users','ow_career_profiles')
         AND grantee='anon' AND privilege_type='SELECT') <> 2 THEN
    RAISE EXCEPTION 'anon の SELECT を巻き込んだ。ロールバック';
  END IF;
END $$;

COMMIT;
