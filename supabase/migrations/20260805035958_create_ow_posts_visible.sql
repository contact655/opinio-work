-- ═══════════════════════════════════════════════════════════════════════════
-- ow_posts_visible — フィード表示用の読み取り専用ビュー
--
-- ── なぜ作るか（2026-08-05）────────────────────────────────────────────────
-- ow_posts.ref_company_id / ref_job_id / ref_article_id の FK は ON DELETE SET NULL。
-- 企業や求人を削除すると投稿は残り、参照だけ黙って外れる。
-- 実際に migration 238（medimo）/ 239（Archi Village・freee・LayerX）がこれを踏み、
-- 参照の外れた投稿が60件できた（job_posted 56 / company_joined 4）。
-- 239 は ow_experiences を company_text へ退避する手当てをしていたのに
-- ow_posts は見落としている。
--
-- 表示上そうした投稿は「押しても何も起きないカード」になる。
-- 埋め込みカードが ref_* を条件に描画されるため、社名すらリンクにならない。
--
-- 除外条件を各クエリに書くと、フィードを引く箇所が増えるたびに同じ事故が起きる。
-- ルールをここ1箇所に置く。
--
-- ⚠️ 行は消さない。DELETE すると幽霊が増える（238/239 と同じ事故）ので、
--    ow_posts はそのままにして、このビューから落とすだけにする。
--
-- ⚠️ 書き込みは従来どおり ow_posts に対して行うこと。このビューには書かない。
--
-- ⚠️ post_type に CHECK 制約は無い（2026-08-05 確認。ow_posts の CHECK は
--    content の文字数のみ）。したがって未知の post_type を黙って消さない。
--    条件を書いていない post_type は素通しする。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_cols int;
BEGIN
  IF to_regclass('public.ow_posts') IS NULL THEN
    RAISE EXCEPTION 'ow_posts が無い。中止';
  END IF;
  IF to_regclass('public.ow_posts_visible') IS NOT NULL THEN
    RAISE EXCEPTION 'ow_posts_visible が既にある。適用済みの可能性。中止';
  END IF;

  -- ビューは列を明示せず SELECT * にしている（列が増えても追随させるため）。
  -- ただし前提として、除外条件に使う列が存在することは確かめておく。
  SELECT count(*) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_posts'
     AND column_name IN ('post_type','ref_job_id','ref_company_id','ref_article_id');
  IF v_cols <> 4 THEN
    RAISE EXCEPTION '除外条件に使う列が揃っていない（% / 4）。中止', v_cols;
  END IF;
END $$;

-- ⚠️ security_invoker = true は必須。
--    これが無いとビューはオーナー権限で走り、ow_posts の RLS を迂回する。
--    フィードの多くは service role で引いているので影響は出ないが、
--    /u/[id] は anon クライアントで引いており、そこで非公開の投稿が漏れる。
--    「表示件数を絞るビュー」が「RLS を外す穴」になっては本末転倒。
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
         ELSE true   -- 未知の post_type は落とさない（CHECK が無いため）
       END;

COMMENT ON VIEW public.ow_posts_visible IS
  'フィード表示用。参照先が消えた投稿（ON DELETE SET NULL で ref_* が外れたもの）を落とす。'
  ' 書き込みは ow_posts に対して行うこと。行は消さない方針なので ow_posts 側には残っている。'
  ' 未知の post_type は素通しする（post_type に CHECK が無いため）。';

-- 読み取り権限。ow_posts と同じ相手に配る。
GRANT SELECT ON public.ow_posts_visible TO anon, authenticated, service_role;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_all int; v_vis int;
  v_job_all int; v_job_vis int;
  v_co_all int;  v_co_vis int;
  v_ar_all int;  v_ar_vis int;
  v_opts text;
BEGIN
  IF to_regclass('public.ow_posts_visible') IS NULL THEN
    RAISE EXCEPTION 'ビューが作られていない。ロールバック';
  END IF;

  -- security_invoker が効いていること（false だと RLS を迂回する）
  SELECT c.reloptions::text INTO v_opts
    FROM pg_class c WHERE c.oid = 'public.ow_posts_visible'::regclass;
  IF v_opts IS NULL OR v_opts NOT LIKE '%security_invoker=true%' THEN
    RAISE EXCEPTION 'security_invoker が付いていない（%）。RLS を迂回するのでロールバック', v_opts;
  END IF;

  SELECT count(*) INTO v_all FROM public.ow_posts;
  SELECT count(*) INTO v_vis FROM public.ow_posts_visible;

  SELECT count(*) INTO v_job_all FROM public.ow_posts WHERE post_type='job_posted';
  SELECT count(*) INTO v_job_vis FROM public.ow_posts_visible WHERE post_type='job_posted';
  SELECT count(*) INTO v_co_all  FROM public.ow_posts WHERE post_type='company_joined';
  SELECT count(*) INTO v_co_vis  FROM public.ow_posts_visible WHERE post_type='company_joined';
  SELECT count(*) INTO v_ar_all  FROM public.ow_posts WHERE post_type='article_published';
  SELECT count(*) INTO v_ar_vis  FROM public.ow_posts_visible WHERE post_type='article_published';

  -- ow_posts 側は1行も減っていないこと
  IF v_all <> 170 THEN
    RAISE EXCEPTION 'ow_posts が % 行（想定170）。行を消していないか確認。ロールバック', v_all;
  END IF;

  -- 2026-08-05 実測の想定値
  IF v_job_vis <> 18 OR v_co_vis <> 76 OR v_ar_vis <> 16 THEN
    RAISE EXCEPTION
      '見える件数が想定と違う（job % / company % / article %、想定 18/76/16）。ロールバック',
      v_job_vis, v_co_vis, v_ar_vis;
  END IF;

  RAISE NOTICE
    '完了: ow_posts % 行はそのまま。ビューからは % 行（job %/% ・ company %/% ・ article %/%）',
    v_all, v_vis, v_job_vis, v_job_all, v_co_vis, v_co_all, v_ar_vis, v_ar_all;
END $$;

COMMIT;
