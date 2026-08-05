-- ═══════════════════════════════════════════════════════════════════════════
-- ow_follows_v — フォローの読み取り用ビュー
--
-- ── なぜ統合せずビューにするか ────────────────────────────────────────────
-- ow_company_follows と ow_user_follows を1テーブルに統合すると、
-- 既存の企業フォローAPI・ボタン・フィードの「フォロー中」タブ・右レールを
-- まとめて書き換えることになる。読み取り側の都合で書き込み側を壊さない。
--
-- ⚠️ 書き込みは従来どおり各テーブルの既存APIを使う。このビューには書かない。
--
-- ⚠️ security_invoker = true は必須。ow_posts_visible と同じ理由で、
--    無いとビューがオーナー権限で走り、両テーブルの RLS を迂回する。
--    ow_user_follows は「本人のフォローのみ」のポリシーなので、
--    外すと誰が誰をフォローしているかが漏れる。
--
-- ── 制約名の是正 ──────────────────────────────────────────────────────────
-- 2026-08-04 の張り替え（ow_career_follows → ow_user_follows）でテーブル名と
-- 列名は変えたが、UNIQUE 制約名が旧名のまま残っていた。
-- 実際に 23505 のメッセージが
--   "ow_career_follows_follower_user_id_target_profile_id_key"
-- を返す（2026-08-05 実測）。存在しないテーブルと列を指す名前で、
-- エラーを読んだ人が別のテーブルを探しに行くことになる。
-- ⚠️ 名前を変えるだけ。データもインデックスの中身も触らない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ow_company_follows') IS NULL THEN
    RAISE EXCEPTION 'ow_company_follows が無い。中止';
  END IF;
  IF to_regclass('public.ow_user_follows') IS NULL THEN
    RAISE EXCEPTION 'ow_user_follows が無い。中止';
  END IF;
  IF to_regclass('public.ow_follows_v') IS NOT NULL THEN
    RAISE EXCEPTION 'ow_follows_v が既にある。適用済みの可能性。中止';
  END IF;
END $$;

-- ── ① 制約名を実態に合わせる ──────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ow_career_follows_follower_user_id_target_profile_id_key'
       AND conrelid = 'public.ow_user_follows'::regclass
  ) THEN
    ALTER TABLE public.ow_user_follows
      RENAME CONSTRAINT ow_career_follows_follower_user_id_target_profile_id_key
                     TO ow_user_follows_follower_user_id_target_user_id_key;
  END IF;
END $$;

-- ── ② ビュー ──────────────────────────────────────────────────────────────
CREATE VIEW public.ow_follows_v
WITH (security_invoker = true)
AS
SELECT
  f.id,
  f.follower_user_id,
  'company'::text AS target_type,
  f.company_id    AS target_id,
  f.created_at
FROM public.ow_company_follows f
UNION ALL
SELECT
  f.id,
  f.follower_user_id,
  'user'::text     AS target_type,
  f.target_user_id AS target_id,
  f.created_at
FROM public.ow_user_follows f;

COMMENT ON VIEW public.ow_follows_v IS
  'フォローの読み取り用。ow_company_follows と ow_user_follows の UNION ALL。'
  ' target_type は company | user。'
  ' ⚠️ 書き込みは各テーブルの既存APIで行うこと。このビューには書かない。'
  ' ⚠️ UNION なので PostgREST のリソース埋め込みは使えない。'
  ' target_id から企業・ユーザーを引くのは呼び出し側で別クエリにすること。';

GRANT SELECT ON public.ow_follows_v TO anon, authenticated, service_role;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_co int; v_us int; v_all int; v_opts text;
BEGIN
  IF to_regclass('public.ow_follows_v') IS NULL THEN
    RAISE EXCEPTION 'ビューが作られていない。ロールバック';
  END IF;

  SELECT c.reloptions::text INTO v_opts FROM pg_class c WHERE c.oid = 'public.ow_follows_v'::regclass;
  IF v_opts IS NULL OR v_opts NOT LIKE '%security_invoker=true%' THEN
    RAISE EXCEPTION 'security_invoker が付いていない（%）。RLS を迂回するのでロールバック', v_opts;
  END IF;

  SELECT count(*) INTO v_co FROM public.ow_company_follows;
  SELECT count(*) INTO v_us FROM public.ow_user_follows;
  SELECT count(*) INTO v_all FROM public.ow_follows_v;
  IF v_all <> v_co + v_us THEN
    RAISE EXCEPTION 'ビューの件数が合わない（% ≠ % + %）。ロールバック', v_all, v_co, v_us;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ow_career_follows_follower_user_id_target_profile_id_key'
  ) THEN
    RAISE EXCEPTION '旧い制約名が残っている。ロールバック';
  END IF;

  RAISE NOTICE '完了: ow_follows_v（company % 件 + user % 件 = % 件）。制約名を是正', v_co, v_us, v_all;
END $$;

COMMIT;
