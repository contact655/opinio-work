-- ═══════════════════════════════════════════════════════════════════════════
-- 投稿の権限と公開範囲
--
--   ① ow_posts.visibility を追加（'public' | 'login_only'、既定 'login_only'）
--   ② 柴さんの追加は保留（CHECK 制約と衝突。下のコメント参照）
--   ③ posts_insert_own RLS に「is_public な company_members であること」を足す
--   ④ ow_posts_visible を作り直す（列が増えたため。定義は同じ）
--
-- ── ③ なぜ投稿できる人を絞るか ─────────────────────────────────────────────
-- これまで ow_posts の INSERT は「自分の行か」しか見ておらず、ログインできる人は
-- 全員投稿できた。is_test = true の社内・検証用アカウント20名も含まれる。
--
-- ⚠️ 条件は is_public のみ。display_consent は使わない。
--    display_consent は「面談OKな人に出してよいか」の意思であって、
--    「発信してよいか」とは別物。流用すると、面談を断った人が発信もできなくなる。
--
-- ⚠️ service_role は素通しにすること。システム投稿（company_joined / job_posted /
--    article_published）は createAdminClient() で入るので、条件を足すと通らなくなる。
--    2026-08-05 時点の INSERT 経路は4つで、うち3つが service_role:
--      admin/articles/actions.ts:40 ・ api/biz/jobs/[id]/route.ts:236 ・
--      api/biz/company/route.ts:225           … service_role（RLS を通らない）
--      api/jobseeker/posts/route.ts POST      … ユーザー権限（この RLS を通る）
--
-- ── ① なぜ投稿に公開範囲を持たせるか ───────────────────────────────────────
-- 実ユーザー5名は全員 ow_users.visibility = 'login_only' なので、投稿しても
-- 未ログインの閲覧者には1件も出ない。フィードの主な閲覧者は未ログインなので、
-- 供給を増やしても届かない。
-- かといって login_only を無視して全体公開にするのは、本人が同意した範囲を
-- 勝手に広げることになる。プロフィール（経歴・年収）を隠す意思と、
-- 投稿を読まれたい意思は別なので、投稿側に別の軸を持たせる。
--
-- ⚠️ 既定は 'login_only'。既存170件もこの既定で入る＝現在の挙動と同じ。
--    ここを 'public' にすると、既存投稿が黙って未ログインに開かれる。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_posts int; v_members int;
BEGIN
  IF to_regclass('public.ow_posts_visible') IS NULL THEN
    RAISE EXCEPTION 'ow_posts_visible が無い。先に 20260805035958 を適用すること。中止';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ow_posts' AND column_name='visibility'
  ) THEN
    RAISE EXCEPTION 'ow_posts.visibility が既にある。適用済みの可能性。中止';
  END IF;

  SELECT count(*) INTO v_posts FROM public.ow_posts;
  IF v_posts <> 170 THEN
    RAISE EXCEPTION 'ow_posts が % 行（想定170）。中止', v_posts;
  END IF;

  SELECT count(*) INTO v_members FROM public.ow_company_members;
  RAISE NOTICE '適用前: ow_posts % 行 / ow_company_members % 行', v_posts, v_members;
END $$;

-- ── ① visibility 列 ───────────────────────────────────────────────────────
ALTER TABLE public.ow_posts
  ADD COLUMN visibility text NOT NULL DEFAULT 'login_only';

ALTER TABLE public.ow_posts
  ADD CONSTRAINT ow_posts_visibility_check CHECK (visibility IN ('public', 'login_only'));

COMMENT ON COLUMN public.ow_posts.visibility IS
  '投稿の公開範囲。public = 未ログインにも出す / login_only = ログイン時のみ。'
  ' 既定は login_only（現在の挙動と同じ）。'
  ' ⚠️ 投稿者の ow_users.visibility とは別軸。判定の優先順位は'
  ' src/lib/feed/visibility.ts に集約している。';

CREATE INDEX idx_ow_posts_visibility ON public.ow_posts USING btree (visibility);

-- ── ② 柴さんの追加は保留 ───────────────────────────────────────────────────
-- ⚠️ 指示は is_public = true / display_consent = false だったが、
--    ow_company_members には CHECK 制約 check_public_requires_consent
--      (is_public = false OR display_consent = true)
--    があり、この組み合わせは入らない（2026-08-05 に実際に 23514 で落ちた）。
--    つまりこのスキーマでは is_public = true は display_consent = true を含意し、
--    「公開掲載には本人の同意が要る」という設計になっている
--    （guard_member_consent トリガーも display_consent を本人以外に変えさせない）。
--    その結果、投稿ゲートを is_public だけにしても display_consent と実質同じになる。
--    どう入れるかは方針を決めてから別 migration で行う。
--
-- ── ③ INSERT の RLS ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS posts_insert_own ON public.ow_posts;

CREATE POLICY posts_insert_own ON public.ow_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT ow_users.id FROM public.ow_users WHERE ow_users.auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.ow_company_members m
       WHERE m.user_id = ow_posts.user_id
         AND m.is_public = true
    )
  );

COMMENT ON POLICY posts_insert_own ON public.ow_posts IS
  '自分の行であること、かつ is_public な ow_company_members であること。'
  ' display_consent は条件に含めない（面談の可否と発信の可否は別の意思）。'
  ' service_role は RLS を通らないのでシステム投稿には影響しない。';

-- ── ④ ow_posts_visible を作り直す ─────────────────────────────────────────
--    列が増えたので SELECT * の実体を更新する必要がある（ビューは作成時の列を固定する）。
--    ⚠️ 参照先が消えた投稿を落とす条件はそのまま。visibility の判定は**足さない**。
--       ここに足すとビューが「誰にとって見えるか」を持つことになり、
--       service role で引くフィードのSSRと食い違う。
--       閲覧者ごとの判定は src/lib/feed/visibility.ts に置く。
DROP VIEW public.ow_posts_visible;

CREATE VIEW public.ow_posts_visible
WITH (security_invoker = true)
AS
SELECT *
  FROM public.ow_posts p
 WHERE CASE p.post_type
         WHEN 'job_posted'        THEN p.ref_job_id     IS NOT NULL
         WHEN 'company_joined'    THEN p.ref_company_id IS NOT NULL
         WHEN 'article_published' THEN p.ref_article_id IS NOT NULL
         WHEN 'user_post'         THEN true
         ELSE true
       END;

COMMENT ON VIEW public.ow_posts_visible IS
  'フィード表示用。参照先が消えた投稿（ON DELETE SET NULL で ref_* が外れたもの）を落とす。'
  ' 書き込みは ow_posts に対して行うこと。行は消さない方針なので ow_posts 側には残っている。'
  ' 未知の post_type は素通しする（post_type に CHECK が無いため）。'
  ' ⚠️ 閲覧者ごとの可視判定（visibility）はここでは行わない。'
  ' src/lib/feed/visibility.ts に集約している。';

GRANT SELECT ON public.ow_posts_visible TO anon, authenticated, service_role;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_all int; v_vis int; v_login int; v_public int;
  v_members int; v_eligible int; v_opts text; v_def text;
BEGIN
  SELECT column_default INTO v_def FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_posts' AND column_name='visibility';
  IF v_def IS NULL OR v_def NOT LIKE '%login_only%' THEN
    RAISE EXCEPTION 'visibility の既定が login_only でない（%）。ロールバック', v_def;
  END IF;

  SELECT count(*) INTO v_all FROM public.ow_posts;
  SELECT count(*) INTO v_login  FROM public.ow_posts WHERE visibility = 'login_only';
  SELECT count(*) INTO v_public FROM public.ow_posts WHERE visibility = 'public';
  IF v_all <> 170 OR v_login <> 170 OR v_public <> 0 THEN
    RAISE EXCEPTION
      '既存投稿の visibility が想定と違う（全 % / login_only % / public %、想定 170/170/0）。ロールバック',
      v_all, v_login, v_public;
  END IF;

  -- ビューが作り直され、security_invoker が残っていること
  SELECT c.reloptions::text INTO v_opts FROM pg_class c WHERE c.oid = 'public.ow_posts_visible'::regclass;
  IF v_opts IS NULL OR v_opts NOT LIKE '%security_invoker=true%' THEN
    RAISE EXCEPTION 'ビューの security_invoker が外れた（%）。ロールバック', v_opts;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ow_posts_visible' AND column_name='visibility'
  ) THEN
    RAISE EXCEPTION 'ビューに visibility 列が出ていない。ロールバック';
  END IF;
  SELECT count(*) INTO v_vis FROM public.ow_posts_visible;
  IF v_vis <> 110 THEN
    RAISE EXCEPTION 'ビューの件数が %（想定110）。ロールバック', v_vis;
  END IF;

  -- メンバー行は触っていないこと（柴さんの追加は保留）
  SELECT count(*) INTO v_members FROM public.ow_company_members;
  IF v_members <> 5 THEN
    RAISE EXCEPTION 'ow_company_members が % 行（想定5・未変更）。ロールバック', v_members;
  END IF;

  SELECT count(DISTINCT m.user_id) INTO v_eligible
    FROM public.ow_company_members m WHERE m.is_public = true;

  RAISE NOTICE
    '完了: visibility 既定 login_only（既存 % 件すべて）。ビュー % 件。'
    ' ow_company_members % 行。投稿できるユーザー % 名',
    v_login, v_vis, v_members, v_eligible;
END $$;

COMMIT;
