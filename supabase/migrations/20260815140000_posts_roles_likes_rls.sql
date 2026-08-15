-- ═══════════════════════════════════════════════════════════════════════════
-- 行がある3テーブルの SELECT を閉じる（ow_posts / ow_post_likes / ow_experience_roles）
--
-- どれも `FOR SELECT USING (true)` ＋ anon にテーブルレベルの SELECT だった。
-- 実測（2026-08-15、anon キーで PostgREST を直接）: ow_posts は **実際に行が返っていた**。
--
-- ⚠️ **4-1.5（実績3種＋発信コンテンツ）の own + admin をそのまま当てない。**
--    あちらは「本人だけが見るもの」。こちらは**他人が読む前提のデータ**が混ざる。
--    テーブルごとに形を分けた。理由は各ブロックに書く。
--
-- ── 読み取り経路の実測（先に全部出した）──────────────────────────────────
--   /feed（一覧）           … createAdminClient（ow_posts_visible / ow_post_likes）
--   /feed/[postId]          … createAdminClient（本文・いいね数）
--   /companies/[id]         … createAdminClient
--   /schools/[id]           … createAdminClient
--   /u/[id]                 … **session クライアント**（ow_posts_visible ＋ 埋め込みの
--                              likes:ow_post_likes(count)。他人の投稿・他人のいいねを読む）
--   /api/jobseeker/posts/[id]/likes … **session クライアント**で他人の投稿を1件読む
--                              （checkPostVisibility）
--   ブラウザ側（クライアントコンポーネント）からの読み取りは **0件**
--
-- ⚠️ `ow_posts_visible` は **security_invoker = true のビュー**。
--    呼び出し元の RLS がそのまま効くので、ビュー経由でも下のポリシーで閉じられる。
--    ビューの anon GRANT も一緒に剥がす（表だけ閉じてビューを開けたままにしない）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_true int; v_posts int; v_roles int; v_likes int;
BEGIN
  SELECT count(*) INTO v_true FROM pg_policies
   WHERE schemaname='public'
     AND tablename IN ('ow_posts','ow_post_likes','ow_experience_roles')
     AND cmd='SELECT' AND qual='true';
  IF v_true <> 3 THEN
    RAISE EXCEPTION 'USING(true) の SELECT ポリシーが % 本（想定3）。既に適用済み？中止', v_true;
  END IF;

  SELECT count(*) INTO v_posts FROM public.ow_posts;
  SELECT count(*) INTO v_roles FROM public.ow_experience_roles;
  SELECT count(*) INTO v_likes FROM public.ow_post_likes;
  IF v_posts <> 170 OR v_roles <> 6 OR v_likes <> 1 THEN
    RAISE EXCEPTION '件数が想定と違う（posts=% / roles=% / likes=%）。中止', v_posts, v_roles, v_likes;
  END IF;
  RAISE NOTICE '適用前: posts=% / experience_roles=% / post_likes=% / USING(true) が3本', v_posts, v_roles, v_likes;
END $$;

-- ═══ ① ow_posts … 「ログイン済みなら読める」 ════════════════════════════════
-- ★own + admin では**フィードが壊れる**。フィードは他人の投稿を読む画面で、
--   /u/[id] と いいねAPI が session クライアントで他人の行を読んでいる。
-- ⚠️ 可視性の細部（visibility 列・is_system の例外）は**ポリシーに持ち込まない**。
--    既に `lib/feed/visibility.ts` の `isPostVisibleTo` に集約されており、
--    表示経路は admin クライアント。二重に置くと片方だけ直したときに食い違う
--    （学歴 20260806200000 と同じ判断）。ここで足すのは「未ログインを落とす」1点だけ。
REVOKE SELECT ON public.ow_posts         FROM anon;
REVOKE SELECT ON public.ow_posts_visible FROM anon;

DROP POLICY "posts_select_public" ON public.ow_posts;
CREATE POLICY "ow_posts_select_authenticated" ON public.ow_posts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ═══ ② ow_post_likes … 「ログイン済みなら読める」 ═════════════════════════════
-- ★own にすると**いいね数が静かに変わる**。/u/[id] は session クライアントで
--   `likes:ow_post_likes(count)` を埋め込みで数えているため、own だと
--   「自分が押した分」しか数えない。HTTP は 200 のまま数字だけ小さくなる。
--   数を見せる列なので、読める範囲は投稿と揃える。
-- ⚠️ 書き込み（INSERT / DELETE）は own のまま。他人のいいねは押せない・消せない。
REVOKE SELECT ON public.ow_post_likes FROM anon;

DROP POLICY "post_likes_select_public" ON public.ow_post_likes;
CREATE POLICY "ow_post_likes_select_authenticated" ON public.ow_post_likes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ═══ ③ ow_experience_roles … 「本人 + admin」 ════════════════════════════════
-- ★こちらは狭い方に倒す。理由は3つ:
--   ① **アプリからの読み取り経路が0件**（`types.ts` にしか現れない未配線テーブル）。
--      閉じても壊れる画面が無い。
--   ② 親の `ow_experiences` は anon の SELECT を剥がしてあるのに、
--      子の職種だけ誰でも読めていた。**親より広いのは筋が通らない。**
--   ③ 配線するときは `ow_experiences` と同じく admin クライアント経由になるので、
--      そのとき RLS を広げ直す必要が無い。
-- ⚠️ このテーブルに user_id は無い。所有者は**親の experience 経由**で判定する。
REVOKE SELECT ON public.ow_experience_roles FROM anon;

DROP POLICY "experience_roles_public_read" ON public.ow_experience_roles;
CREATE POLICY "ow_experience_roles_select_own" ON public.ow_experience_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ow_experiences e
       WHERE e.id = ow_experience_roles.experience_id
         AND e.user_id IN (SELECT u.id FROM public.ow_users u WHERE u.auth_id = auth.uid())
    )
  );
CREATE POLICY "ow_experience_roles_select_admin" ON public.ow_experience_roles
  FOR SELECT USING (public.auth_is_admin());

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_true int; v_posts int; v_roles int; v_likes int; t text;
BEGIN
  SELECT count(*) INTO v_true FROM pg_policies
   WHERE schemaname='public'
     AND tablename IN ('ow_posts','ow_post_likes','ow_experience_roles')
     AND cmd='SELECT' AND qual='true';
  IF v_true <> 0 THEN RAISE EXCEPTION 'USING(true) が % 本残っている。ロールバック', v_true; END IF;

  -- 書き込みポリシーを消していないこと（posts 2本 / likes 2本）
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname='public' AND tablename IN ('ow_posts','ow_post_likes')
         AND cmd IN ('INSERT','UPDATE','DELETE')) <> 4 THEN
    RAISE EXCEPTION '書き込みポリシーの本数が変わった。ロールバック';
  END IF;

  -- anon は剥奪、authenticated は残っていること
  FOREACH t IN ARRAY ARRAY['ow_posts','ow_posts_visible','ow_post_likes','ow_experience_roles']
  LOOP
    IF has_table_privilege('anon', 'public.'||t, 'SELECT') THEN
      RAISE EXCEPTION '% の anon SELECT が残っている。ロールバック', t;
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.'||t, 'SELECT') THEN
      RAISE EXCEPTION '% の authenticated SELECT まで消えた。ロールバック', t;
    END IF;
  END LOOP;

  -- ★既存データは1行も変えていないこと
  SELECT count(*) INTO v_posts FROM public.ow_posts;
  SELECT count(*) INTO v_roles FROM public.ow_experience_roles;
  SELECT count(*) INTO v_likes FROM public.ow_post_likes;
  IF v_posts <> 170 OR v_roles <> 6 OR v_likes <> 1 THEN
    RAISE EXCEPTION '件数が変わった（posts=% / roles=% / likes=%）。ロールバック', v_posts, v_roles, v_likes;
  END IF;

  RAISE NOTICE '完了: posts/likes は authenticated、experience_roles は own+admin。件数は % / % / % で変更なし', v_posts, v_roles, v_likes;
END $$;

COMMIT;
