-- ═══════════════════════════════════════════════════════════════════════════
-- シードの auth ユーザー20件と、それが持つ ow_profiles を消す（2026-08-28）
--
-- ── 何を消すのか（先に原因を特定した）──────────────────────────────────────
-- `ow_profiles.user_id`（**auth 空間**）に対応する `ow_users` の行が無いもの20件。
-- 2026-08-19 に「孤児20件」として記録され、**消されたユーザーの残骸か検証用か
-- 分からない**ので保留になっていた。2026-08-28 に調べたところ:
--
--   * 20件とも **`auth.users` に今も存在する**（削除の残骸ではない）
--   * メールは **全件 `@example.com`**（tanaka.shota@ / sato.misaki@ …）
--   * 作成は **2026-04-09 08:14:21〜23 の約2秒**＝一括投入されたシードデータ
--   * `email_confirmed_at` は全件あり。`last_sign_in_at` は19件 NULL
--     （1件だけ 2026-04-28 に1回。当時は `linkOwUser` の経路がまだ無く
--      `postAuth` は 2026-08-14 なので、`ow_users` が作られなかった）
--   * `onboarding_completed` 全件 false / 希望条件も `career_stance` も全件空
--
-- ⚠️ CLAUDE.md の週次メールの節にある「**example.com 20件は必ずハードバウンスする**」と
--    同じ20件。`getWeeklyRecipients()` が除外しているので実害は出ていなかった。
--
-- ── なぜ消すか ──────────────────────────────────────────────────────────────
-- 放置しても壊れないが、**`ow_profiles` 52 と `ow_users` 38 の差**が数え直しのたびに
-- 混乱を生み、実際に 2026-08-10（週次メールの宛先）と 2026-08-19（孤児の調査）の
-- **2回**調べ直している。**「起こらなかった0」と「起こせなかった0」の判別を
-- 毎回やり直すコスト**のほうが、消さずに残す利点を上回った。
--
-- ── ★参照の確認（2026-08-28 実測）──────────────────────────────────────────
-- `auth.users` を参照する FK を持つ **29テーブル全部**で対象20件を数えた結果、
-- **`ow_profiles` の20行以外はすべて 0件。**
--   CASCADE 側: ow_user_roles / ow_terms_agreements / ow_profile_desired_roles /
--               ow_favorites / ow_job_favorites / ow_user_profiles / ow_scout_blocks /
--               ow_placements / ow_match_scores / ow_post_hire_reports … 全部 0
--   NO ACTION 側（残っていれば DELETE が弾かれる）: ow_applications / ow_companies /
--               ow_invoices / ow_saved_companies / ow_saved_jobs / ow_scouts … 全部 0
--   SET NULL 側: ow_job_views / ow_company_members.invited_by /
--               ow_company_external_links.created_by_user_id … 全部 0
--
-- ⚠️ **`ow_profiles.user_id` は `auth.users` への FK を持ち、削除規則は CASCADE。**
--    したがって `auth.users` を消せば `ow_profiles` も一緒に消える。
--    ⚠️ `information_schema.constraint_column_usage` では**この FK が見えない**
--       （参照先が別スキーマのため）。`pg_constraint` で見ること。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   .dumps/20260828-1625-ow_profiles.sql   （スキーマ+データ / 52行）
--   .dumps/20260828-auth-orphans.json      （auth ユーザー20件の全項目）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
--   ⚠️ 戻すときは auth ユーザーを作り直すことになるので **id は変わる**。
--      「同じ行に戻す」ことはできない。中身の記録として残しているだけ。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ⚠️ 対象は id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」と同じ理由）。
--    条件で書くと、条件のほうが将来ずれたときに違うものを消す。
CREATE TEMP TABLE _seed_ids(id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _seed_ids(id) VALUES
  ('64e85329-4b7e-49fc-9a12-ee9c6b390e92'),('e03c7de9-1bbe-48fe-98f6-36d2b6f9125a'),
  ('86d4293a-bef2-4e0f-8a9a-0ef7ee7ef3ca'),('447e233e-2736-47ba-b749-5d523ee33f36'),
  ('db90f1e0-9a5f-4008-89a4-fffc0b05dd12'),('94709298-babf-4b2f-b2c9-1f419c33d825'),
  ('04d99081-0e03-4a24-9278-b98757184770'),('ca5bcf7d-6a41-4e9b-b13e-2944652b1baf'),
  ('2f778cd0-ed9c-4dd1-b76f-ffb32fabc757'),('3c23c84d-696d-40a0-99a2-f2f74296cc1b'),
  ('d9e1417d-9e0c-4eb0-8a2d-1f606f47aabb'),('3bf5547c-f00d-4fa5-91e9-daff9c66c075'),
  ('b309be1c-18da-48a1-955b-6f5bac5ac16c'),('4ca3e547-1d2f-4a40-a34c-6e85d2a4ddfe'),
  ('6530102c-7ece-46c9-a279-9f6f51944f73'),('2d7fb6a7-eb17-497f-9991-d0c3ad2dbaaf'),
  ('4d399d54-95f6-4cba-bd23-829c2686c56b'),('9f856a2a-1d1c-45cd-93e0-60e42959dbb8'),
  ('ddc27fdc-f19f-4c3e-bf80-d90791573b21'),('a9800d8f-c7a3-40ce-b3c3-8d355a5700f7');

DO $$
DECLARE
  v_n int; v_mail int; v_linked int; v_prof int;
  v_users_before int; v_prof_before int;
BEGIN
  SELECT count(*) INTO v_n FROM _seed_ids;
  IF v_n <> 20 THEN RAISE EXCEPTION 'id の列挙が % 件（20 のはず）。中止', v_n; END IF;

  -- ★① 全件 auth.users に実在し、**全件 @example.com** であること
  SELECT count(*) INTO v_mail FROM auth.users a JOIN _seed_ids s ON s.id = a.id
   WHERE a.email LIKE '%@example.com';
  IF v_mail <> 20 THEN
    RAISE EXCEPTION '@example.com は % 件（20 のはず）。実在のアドレスが混ざっている。中止', v_mail;
  END IF;

  -- ★② ow_users に紐づいた行が1件も無いこと（＝本当に「孤児」であること）
  SELECT count(*) INTO v_linked FROM public.ow_users u JOIN _seed_ids s ON s.id = u.auth_id;
  IF v_linked <> 0 THEN
    RAISE EXCEPTION 'ow_users に紐づく行が % 件ある。実利用者が混ざっている。中止', v_linked;
  END IF;

  -- ★③ ow_profiles 側もちょうど20行であること
  SELECT count(*) INTO v_prof FROM public.ow_profiles p JOIN _seed_ids s ON s.id = p.user_id;
  IF v_prof <> 20 THEN RAISE EXCEPTION 'ow_profiles が % 行（20 のはず）。中止', v_prof; END IF;

  SELECT count(*) INTO v_users_before FROM auth.users;
  SELECT count(*) INTO v_prof_before  FROM public.ow_profiles;
  RAISE NOTICE '適用前: auth.users % 行 / ow_profiles % 行', v_users_before, v_prof_before;
END $$;

/* ⚠️ **`ow_profiles` を先に明示的に消す。**
      FK は CASCADE なので auth.users を消せば連鎖するが、**連鎖に任せない。**
      「何行消えるつもりか」を自分で書いておかないと、後から読んだ人が
      「ow_profiles は無傷のはず」と誤読する。 */
DELETE FROM public.ow_profiles p USING _seed_ids s WHERE p.user_id = s.id;

DELETE FROM auth.users a USING _seed_ids s WHERE a.id = s.id;

DO $$
DECLARE
  v_left_auth int; v_left_prof int; v_orphan int;
  v_users int; v_prof int; v_owusers int;
BEGIN
  SELECT count(*) INTO v_left_auth FROM auth.users a JOIN _seed_ids s ON s.id = a.id;
  IF v_left_auth <> 0 THEN RAISE EXCEPTION 'auth.users に % 件残っている。中止', v_left_auth; END IF;

  SELECT count(*) INTO v_left_prof FROM public.ow_profiles p JOIN _seed_ids s ON s.id = p.user_id;
  IF v_left_prof <> 0 THEN RAISE EXCEPTION 'ow_profiles に % 件残っている。中止', v_left_prof; END IF;

  -- ★孤児が 0 になったこと（この migration の目的そのもの）
  SELECT count(*) INTO v_orphan FROM public.ow_profiles p
   WHERE NOT EXISTS (SELECT 1 FROM public.ow_users u WHERE u.auth_id = p.user_id);
  IF v_orphan <> 0 THEN RAISE EXCEPTION '孤児が % 件残っている。中止', v_orphan; END IF;

  -- ★消しすぎていないこと。ow_users は1行も減っていないはず（紐づきが無かったので）
  SELECT count(*) INTO v_users FROM auth.users;
  SELECT count(*) INTO v_prof  FROM public.ow_profiles;
  SELECT count(*) INTO v_owusers FROM public.ow_users;
  IF v_owusers <> 38 THEN RAISE EXCEPTION 'ow_users が % 行（38 のはず）。巻き込んだ。中止', v_owusers; END IF;
  IF v_prof <> 32 THEN RAISE EXCEPTION 'ow_profiles が % 行（52-20=32 のはず）。中止', v_prof; END IF;

  RAISE NOTICE '完了: auth.users % 行 / ow_profiles % 行 / ow_users % 行 / 孤児 %',
    v_users, v_prof, v_owusers, v_orphan;
END $$;

COMMIT;
