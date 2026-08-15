-- ═══════════════════════════════════════════════════════════════════════════
-- ow_post_comments の SELECT を「ログイン済み」に絞る
--
-- ── 直す前（2026-08-16 実測）────────────────────────────────────────────
--   comments_select_public 相当（`FOR SELECT USING (true)`）＋ anon に GRANT
--   行: **0件**
--
-- ★形は own + admin ではなく **authenticated**。`ow_post_likes` と同じ理由:
--   ① コメントは**他人が読む前提**のデータ。own にするとフィードで自分のコメントしか
--      見えなくなる
--   ② **コメント数が静かに小さくなる**。`comments:ow_post_comments(count)` を
--      4箇所で埋め込んでおり、読める範囲を狭めると数字だけが減る
--      （HTTP は 200 のまま）
--
-- ── 製品判断 ─────────────────────────────────────────────────────────────
--   投稿本体（ow_posts）を 20260815140000 で未ログインから読めなくした。
--   **コメントだけ直接読めるのは筋が通らない**ので揃える。
--   あわせて `GET /api/jobseeker/posts/[id]/comments` の「認証不要」もやめる（同じコミット）。
--
-- ── 塞ぐ前に確認したこと ────────────────────────────────────────────────
--   `comments:ow_post_comments(count)` の4箇所は**すべて createAdminClient**
--   （feed 一覧 / パーマリンク / API 2本）。数字は RLS の影響を受けない。
--   ブラウザから叩くのは `FeedClient` の1箇所（コメント展開時）だけで、
--   これは `/feed` でしか使われない。`/feed` は未ログインでも開けるが、
--   **未ログインには投稿が1件も出ない**（110件すべて `visibility='login_only'` で
--   `isPostVisibleTo` が落とす。実測で「ログインすると投稿・いいね・コメントができます」の
--   表示のみ）ため、コメント展開に到達しない。
--   `/companies/[id]` `/schools/[id]` は投稿を出すが**コメントは描画していない**（grep で0件）。
--
-- ⚠️ 将来 `visibility='public'` の投稿を作るなら、未ログインの /feed に投稿が出るので
--    そのときコメント欄の見せ方（ログインを促す文言）を決めること。
--    いまは「取得に失敗しました」と出る作りになっている。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_rows int; v_pub int;
BEGIN
  SELECT count(*) INTO v_rows FROM public.ow_post_comments;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ow_post_comments が % 件（想定0）。中止', v_rows; END IF;

  SELECT count(*) INTO v_pub FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_post_comments' AND cmd='SELECT' AND qual='true';
  IF v_pub <> 1 THEN RAISE EXCEPTION 'USING(true) の SELECT ポリシーが % 本（想定1）。中止', v_pub; END IF;
  RAISE NOTICE '適用前: ow_post_comments 0件 / USING(true) あり';
END $$;

REVOKE SELECT ON public.ow_post_comments FROM anon;

DO $$
DECLARE v_name text;
BEGIN
  SELECT policyname INTO v_name FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_post_comments' AND cmd='SELECT' AND qual='true'
   LIMIT 1;
  EXECUTE format('DROP POLICY %I ON public.ow_post_comments', v_name);
  RAISE NOTICE '削除したポリシー: %', v_name;
END $$;

CREATE POLICY "ow_post_comments_select_authenticated" ON public.ow_post_comments
  FOR SELECT USING (auth.uid() IS NOT NULL);

DO $$
BEGIN
  IF has_table_privilege('anon','public.ow_post_comments','SELECT') THEN
    RAISE EXCEPTION 'anon の SELECT が残っている。ロールバック';
  END IF;
  IF NOT has_table_privilege('authenticated','public.ow_post_comments','SELECT') THEN
    RAISE EXCEPTION 'authenticated の SELECT まで消えた。ロールバック';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname='public' AND tablename='ow_post_comments'
                AND cmd='SELECT' AND qual='true') THEN
    RAISE EXCEPTION 'USING(true) が残っている。ロールバック';
  END IF;
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname='public' AND tablename='ow_post_comments'
         AND cmd IN ('INSERT','UPDATE','DELETE')) = 0 THEN
    RAISE EXCEPTION '書き込みポリシーが1本も無い。ロールバック';
  END IF;
  IF (SELECT count(*) FROM public.ow_post_comments) <> 0 THEN
    RAISE EXCEPTION '件数が変わった。ロールバック';
  END IF;
  RAISE NOTICE '完了: SELECT は authenticated。anon は剥奪。0件のまま';
END $$;

COMMIT;
