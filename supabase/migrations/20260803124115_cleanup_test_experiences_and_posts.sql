-- ═══════════════════════════════════════════════════════════════════════════
-- 柴（s.hisato1020@gmail.com）アカウントのテストデータ整理
--
-- 対象ユーザー: e826e0bd-f96b-42ec-acda-d8f482e1417d
--   name=「柴 久人」/ email=s.hisato1020@gmail.com / auth あり / is_test=false
--
-- ⚠️ このユーザーは削除しない。柴さん本人の実アカウントであり、
--    株式会社Third Box・株式会社Opinio の company_admin を持つ。
--    実データ（獨協大学の学歴・国家資格キャリアコンサルタント・スキルタグ10件）も
--    このアカウントにしか無い（hshiba@opinio.co.jp 側は職歴・投稿ともに0件）。
--
-- ⚠️ is_test も立てない。
--    is_test=true にしても /api/salary-reports は is_test を見ないため
--    年収データは公開されたままになる（＝目的を達成しない）。
--    加えて実企業の admin を持つアカウントをテスト扱いにすると
--    今後の集計・審査で扱いが混乱する。
--
-- このマイグレーションで消すのは「明らかな入力テストの痕跡」だけに限定する。
-- 判断が要るもの（年収レポート・重複した株式会社TEST レコード）は含めない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_user  uuid := 'e826e0bd-f96b-42ec-acda-d8f482e1417d';
  v_exp_before int; v_post_before int; v_ach_before int;
  v_exp_del int; v_post_del int; v_ach_del int;
  v_likes int; v_comments int; v_notif int;
  v_exp_child int;
  v_kept_edu int; v_kept_skill int; v_kept_cert int; v_kept_admin int;
BEGIN
  -- ── 事前チェック0: 対象ユーザーが想定どおりか ────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM ow_users
     WHERE id = v_user AND email = 's.hisato1020@gmail.com' AND auth_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION '対象ユーザーが想定と異なる（id/email/auth_id 不一致）。中止';
  END IF;

  -- ── 事前チェック1: 消す職歴の件数と中身 ──────────────────────────────────
  --    company_id が付いている行は実企業への紐づけなので対象外にする。
  --    company_text がテスト文字列の行だけを消す。
  SELECT count(*) INTO v_exp_before
    FROM ow_experiences
   WHERE user_id = v_user
     AND company_id IS NULL
     AND company_text IN ('株式会社TEST', '株式会社TEST2', '株式会社TEST3', '副業先株式会社');

  IF v_exp_before <> 4 THEN
    RAISE EXCEPTION 'テスト職歴が想定4件ではなく % 件。データが変わっているため中止', v_exp_before;
  END IF;

  -- このユーザーに他の職歴が無いことを確認（あれば消し漏れ/消しすぎの兆候）
  IF (SELECT count(*) FROM ow_experiences WHERE user_id = v_user) <> 4 THEN
    RAISE EXCEPTION '職歴の総数が4件ではない。想定外の職歴があるため中止';
  END IF;

  -- ── 事前チェック2: 職歴に紐づく子レコードを把握する ──────────────────────
  --    ow_experiences を参照する FK は4本すべて ON DELETE CASCADE。
  --    エラーで止まらず黙って巻き込むので、消える前に件数を見る。
  SELECT
    (SELECT count(*) FROM ow_experience_roles r JOIN ow_experiences e ON e.id=r.experience_id WHERE e.user_id=v_user)
  + (SELECT count(*) FROM ow_experience_stories s JOIN ow_experiences e ON e.id=s.experience_id WHERE e.user_id=v_user)
  + (SELECT count(*) FROM ow_story_sections s JOIN ow_experiences e ON e.id=s.experience_id WHERE e.user_id=v_user)
  + (SELECT count(*) FROM ow_company_hidden_experiences h JOIN ow_experiences e ON e.id=h.experience_id WHERE e.user_id=v_user)
    INTO v_exp_child;
  RAISE NOTICE '職歴の子レコード（CASCADE で巻き込まれる）: % 件', v_exp_child;

  -- ── 事前チェック3: 消す投稿の件数と中身 ──────────────────────────────────
  SELECT count(*) INTO v_post_before
    FROM ow_posts
   WHERE user_id = v_user AND post_type = 'user_post' AND content IN ('テスト', 'あああああ');
  IF v_post_before <> 2 THEN
    RAISE EXCEPTION 'テスト投稿が想定2件ではなく % 件。中止', v_post_before;
  END IF;

  -- 投稿に他ユーザーの反応が付いていたら消さない（他人の行動を巻き込まない）
  SELECT count(*) INTO v_likes
    FROM ow_post_likes l JOIN ow_posts p ON p.id = l.post_id
   WHERE p.user_id = v_user AND p.content IN ('テスト', 'あああああ');
  SELECT count(*) INTO v_comments
    FROM ow_post_comments c JOIN ow_posts p ON p.id = c.post_id
   WHERE p.user_id = v_user AND p.content IN ('テスト', 'あああああ');
  SELECT count(*) INTO v_notif
    FROM ow_notifications n JOIN ow_posts p ON p.id = n.post_id
   WHERE p.user_id = v_user AND p.content IN ('テスト', 'あああああ');
  IF v_likes > 0 OR v_comments > 0 OR v_notif > 0 THEN
    RAISE EXCEPTION '投稿にいいね % / コメント % / 通知 % が付いている。他ユーザーの行動を巻き込むため中止',
      v_likes, v_comments, v_notif;
  END IF;

  -- ── 事前チェック4: 実績「あああああ」 ────────────────────────────────────
  SELECT count(*) INTO v_ach_before
    FROM ow_user_achievements WHERE user_id = v_user AND title = 'あああああ';
  IF v_ach_before <> 1 THEN
    RAISE EXCEPTION '実績「あああああ」が想定1件ではなく % 件。中止', v_ach_before;
  END IF;

  -- ═══ 削除 ═══════════════════════════════════════════════════════════════
  DELETE FROM ow_experiences
   WHERE user_id = v_user
     AND company_id IS NULL
     AND company_text IN ('株式会社TEST', '株式会社TEST2', '株式会社TEST3', '副業先株式会社');
  GET DIAGNOSTICS v_exp_del = ROW_COUNT;

  DELETE FROM ow_posts
   WHERE user_id = v_user AND post_type = 'user_post' AND content IN ('テスト', 'あああああ');
  GET DIAGNOSTICS v_post_del = ROW_COUNT;

  DELETE FROM ow_user_achievements WHERE user_id = v_user AND title = 'あああああ';
  GET DIAGNOSTICS v_ach_del = ROW_COUNT;

  -- ── 事後チェック: 消しすぎていないこと ───────────────────────────────────
  IF v_exp_del <> 4 OR v_post_del <> 2 OR v_ach_del <> 1 THEN
    RAISE EXCEPTION '削除件数が想定と異なる（職歴 % / 投稿 % / 実績 %）。ロールバック',
      v_exp_del, v_post_del, v_ach_del;
  END IF;

  -- 残すべき実データが無傷であること
  SELECT count(*) INTO v_kept_edu   FROM ow_user_educations    WHERE user_id = v_user;
  SELECT count(*) INTO v_kept_skill FROM ow_user_skill_tags    WHERE user_id = v_user;
  SELECT count(*) INTO v_kept_cert  FROM ow_user_certifications WHERE user_id = v_user;
  SELECT count(*) INTO v_kept_admin FROM ow_company_admins     WHERE user_id = v_user;
  IF v_kept_edu <> 2 OR v_kept_skill <> 10 OR v_kept_cert <> 1 OR v_kept_admin <> 3 THEN
    RAISE EXCEPTION '残すべきデータが変化した（学歴 %/2・スキル %/10・資格 %/1・admin %/3）。ロールバック',
      v_kept_edu, v_kept_skill, v_kept_cert, v_kept_admin;
  END IF;

  -- ユーザー本体が残っていること
  IF NOT EXISTS (SELECT 1 FROM ow_users WHERE id = v_user) THEN
    RAISE EXCEPTION 'ユーザー本体が消えた。ロールバック';
  END IF;

  RAISE NOTICE '完了: 職歴 % 件 / 投稿 % 件 / 実績 % 件を削除。学歴・スキル・資格・admin は保持',
    v_exp_del, v_post_del, v_ach_del;
END $$;

COMMIT;
