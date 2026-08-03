-- ═══════════════════════════════════════════════════════════════════════════
-- 社内アカウント2件を is_test = true にする
--
-- ── なぜ削除ではなく is_test か ──────────────────────────────────────────────
-- 2件とも auth.users に実在し、直近でログインしている現役のアカウント。
-- 削除すると本人がログインできなくなる。
-- is_test = true は既に「社内・検証用アカウントを公開面から外す」印として
-- 使われており（opinio.co.jp 15件 / third-box.jp 2件 / gmail 1件）、
-- /people・/feed・/biz/candidates・LP の集計から一律で除外される。
-- ログインとマイページには影響しない。取り消しも UPDATE 1本で効く。
--
-- ── 対象1: 柴久人 <hshiba@opinio.co.jp> ─────────────────────────────────────
-- 柴さんのアカウントが2つある。
--   hshiba@opinio.co.jp      作成 2026-03-11 / 最終ログイン 2026-07-26 / 中身ゼロ
--   s.hisato1020@gmail.com   作成 2026-04-30 / 最終ログイン 2026-07-13 / 完成度55%
-- 運用で使っているのは前者、プロフィールが入っているのは後者。
-- /people を登録ユーザー一覧にすると、中身ゼロの前者が並んでしまう。
--
-- ⚠️ 前者を「捨ててよいアカウント」と判断したわけではない。ログインは残す。
--    もしプロフィールを hshiba 側に寄せたいなら、この migration ではなく
--    中身を移す作業になる。その場合はこの1件を戻すこと。
--
-- ── 対象2: 鈴木 太郎 <contact+15@opinio.co.jp> ───────────────────────────────
-- 個別の判断ではなく、既にあるルールの適用漏れ。
-- archive/277_set_is_test_flag.sql（2026-07-27）が
--   WHERE email ILIKE 'contact+%@opinio.co.jp'
-- で15件を一括して is_test = true にしている。
-- contact+15 の作成は 2026-08-03 で、この一括処理より後。
-- 同じパターンに当てはまるのに、後から作られたので取り残されただけ。
-- 作成もログインも 2026-08-03 のみ、プロフィールは空、という実態とも整合する。
-- （20260803163809 で visibility を login_only に戻した14名のうちの1名でもある）
--
-- ⚠️ 277 は一度きりの backfill なので、今後 contact+16 以降が作られれば
--    同じ取り残しが起きる。恒久対応（トリガーか定期ジョブ）は別途。
--
-- ── 安全側の作り ────────────────────────────────────────────────────────────
-- UPDATE なので FK の CASCADE は関係しないが、
-- 「中身が空であること」は隠す前に確かめる意味がある。
-- 対象行にプロフィールの実体（職歴・学歴・スキル・資格・発信・所属・自己紹介・
-- 写真）が1件でもあれば中止する。取り違えと、後から中身が入った場合の事故を防ぐ。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_emails  text[] := ARRAY['hshiba@opinio.co.jp', 'contact+15@opinio.co.jp'];
  v_ids     uuid[];
  v_found   int;
  v_already int;
  v_content int;
  v_updated int;
  v_after   int;
  v_shiba   int;
BEGIN
  -- ── ① 対象がちょうど2件あること ────────────────────────────────────────
  SELECT array_agg(id), count(*) INTO v_ids, v_found
    FROM ow_users WHERE email = ANY(v_emails);

  IF v_found <> 2 THEN
    RAISE EXCEPTION '対象が % 件（想定2件）。メールアドレスを確認して中止', v_found;
  END IF;

  SELECT count(*) INTO v_already
    FROM ow_users WHERE id = ANY(v_ids) AND is_test IS TRUE;
  IF v_already > 0 THEN
    RAISE EXCEPTION '既に is_test = true の行が % 件ある。適用済みの可能性。中止', v_already;
  END IF;

  -- ── ② 中身が空であること ────────────────────────────────────────────────
  --    どれか1件でもあれば「空のアカウント」という前提が崩れるので中止する。
  SELECT
      (SELECT count(*) FROM ow_experiences          WHERE user_id = ANY(v_ids))
    + (SELECT count(*) FROM ow_user_educations      WHERE user_id = ANY(v_ids))
    + (SELECT count(*) FROM ow_user_skill_tags      WHERE user_id = ANY(v_ids))
    + (SELECT count(*) FROM ow_user_certifications  WHERE user_id = ANY(v_ids))
    + (SELECT count(*) FROM ow_user_content_links   WHERE user_id = ANY(v_ids))
    + (SELECT count(*) FROM ow_company_members      WHERE user_id = ANY(v_ids))
    + (SELECT count(*) FROM ow_users
        WHERE id = ANY(v_ids)
          AND (COALESCE(TRIM(about_me), '') <> '' OR avatar_url IS NOT NULL))
    INTO v_content;

  IF v_content > 0 THEN
    RAISE EXCEPTION
      '対象アカウントにプロフィールの実体が % 件ある。空である前提が崩れたので中止', v_content;
  END IF;

  -- ── ③ 柴さんの残すほう（s.hisato1020@gmail.com）を巻き込まないこと ──────
  SELECT count(*) INTO v_shiba
    FROM ow_users WHERE email = 's.hisato1020@gmail.com' AND is_test IS NOT TRUE;
  IF v_shiba <> 1 THEN
    RAISE EXCEPTION
      's.hisato1020@gmail.com が公開対象として1件見つからない（% 件）。中止', v_shiba;
  END IF;

  -- ── ④ 適用 ──────────────────────────────────────────────────────────────
  UPDATE ow_users SET is_test = true, updated_at = NOW()
   WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- ── ⑤ 事後チェック ──────────────────────────────────────────────────────
  IF v_updated <> 2 THEN
    RAISE EXCEPTION '更新が % 件（想定2件）。ロールバック', v_updated;
  END IF;

  -- 公開面に出る実ユーザーが5名になること
  SELECT count(*) INTO v_after
    FROM ow_users
   WHERE is_test IS NOT TRUE AND is_system IS NOT TRUE AND name IS NOT NULL;
  IF v_after <> 5 THEN
    RAISE EXCEPTION '実ユーザーが % 名（想定5名）。ロールバック', v_after;
  END IF;

  -- 柴さんのプロフィール側が生きていること（③ の再確認）
  IF NOT EXISTS (
    SELECT 1 FROM ow_users
     WHERE email = 's.hisato1020@gmail.com' AND is_test IS NOT TRUE
  ) THEN
    RAISE EXCEPTION '柴さんのプロフィール側アカウントまで除外された。ロールバック';
  END IF;

  RAISE NOTICE '完了: 2件を is_test = true にした。公開対象の実ユーザーは % 名', v_after;
END $$;

COMMIT;
