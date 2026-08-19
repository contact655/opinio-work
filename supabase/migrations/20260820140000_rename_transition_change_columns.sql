-- ═══════════════════════════════════════════════════════════════════════════
-- ow_transitions: is_role_change / is_industry_change を改名する（2026-08-20）
--
--   is_role_change     → role_change
--   is_industry_change → industry_change
--
-- ── なぜ ─────────────────────────────────────────────────────────────────
--   どちらも **boolean ではなく3値**（`changed` / `unchanged` / `unknown`）。
--   `is_` で始まる列名は boolean だと読まれるので、
--   `if (t.is_industry_change)` のように書かれると **`'unchanged'` も truthy** になり、
--   「業種が変わっていない転職」まで「変わった」に数えられる。
--   **列名で誤読を招く形を残さない。**
--
-- ── なぜ今か ─────────────────────────────────────────────────────────────
--   ⚠️ `ow_transitions` は**導出テーブル**（洗い替えで作り直す）で、
--      実データは5行しかなく、参照しているアプリコードも**まだ無い**。
--      **今なら改名しても失うものが無い。** 使われ始めてからでは代償が生まれる。
--
-- ⚠️ CHECK 制約の名前は `..._is_role_change_check` のまま残るが、
--    定義は列に追従する。名前だけの問題なので付け替えない（履歴が読みにくくなる）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_rows int; v_old int;
BEGIN
  SELECT count(*) INTO v_old FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_transitions'
     AND column_name IN ('is_role_change','is_industry_change');
  IF v_old <> 2 THEN
    RAISE EXCEPTION '旧列が % 本（想定2）。既に改名済みか、前提が違う。中止', v_old;
  END IF;

  SELECT count(*) INTO v_rows FROM public.ow_transitions;
  RAISE NOTICE '適用前: 旧列2本 / ow_transitions % 行', v_rows;
END $$;

ALTER TABLE public.ow_transitions RENAME COLUMN is_role_change     TO role_change;
ALTER TABLE public.ow_transitions RENAME COLUMN is_industry_change TO industry_change;

COMMENT ON COLUMN public.ow_transitions.role_change IS
  'changed / unchanged / unknown の3値。**boolean ではない**（2026-08-20 に is_ を外した）。';
COMMENT ON COLUMN public.ow_transitions.industry_change IS
  'changed / unchanged / unknown の3値。**boolean ではない**。'
  '自由入力の企業は業種が引けないので unknown。'
  '⚠️ unknown を unchanged に潰すと異業界転職が少なく出る。';

-- ── 洗い替え関数を新しい列名で作り直す ──────────────────────────────────
--   ⚠️ 関数の本体は Postgres が依存として追跡しない。**列を改名しても関数は直らない。**
--      改名と同じ migration で必ず作り直すこと（CLAUDE.md「DROP のチェックリスト」と同じ根）。
CREATE OR REPLACE FUNCTION public.rebuild_ow_transitions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_count integer;
BEGIN
  /* ⚠️ **`WHERE true` を省かない**。Supabase の PostgREST 経由では `safeupdate` が効いており、
        WHERE の無い DELETE は 21000「DELETE requires a WHERE clause」で弾かれる。
        SQL で直接呼ぶと通るので、**RPC で叩くまで気づけない。** */
  DELETE FROM public.ow_transitions WHERE true;

  INSERT INTO public.ow_transitions (
    user_id,
    from_company_id, to_company_id, from_company_text, to_company_text,
    from_role_category_id, to_role_category_id,
    from_industry, to_industry,
    moved_at, age_at_move, years_of_experience_at_move,
    role_change, industry_change
  )
  WITH exp AS (
    SELECT
      e.id, e.user_id, e.company_id, e.company_text, e.role_category_id,
      e.started_at, e.ended_at,
      /* 会社の同一性キー。マスタ紐づけは id、自由入力は正規化した社名、
         匿名企業は行ごとに別会社として扱う（同じ会社かどうか判定できないため）。 */
      COALESCE(e.company_id::text, LOWER(BTRIM(e.company_text)), 'anon:' || e.id::text) AS ckey
    FROM public.ow_experiences e
    JOIN public.ow_users u ON u.id = e.user_id
    /* ⚠️ 検証用アカウントとシステムユーザーは入れない。集計に混ざる。 */
    WHERE COALESCE(u.is_test, false) = false
      AND COALESCE(u.is_system, false) = false
  ),
  first_start AS (
    SELECT user_id, MIN(started_at) AS career_start FROM exp GROUP BY user_id
  ),
  pairs AS (
    SELECT
      user_id, ckey, company_id, company_text, role_category_id,
      LEAD(ckey)             OVER w AS to_ckey,
      LEAD(company_id)       OVER w AS to_company_id,
      LEAD(company_text)     OVER w AS to_company_text,
      LEAD(role_category_id) OVER w AS to_role_category_id,
      LEAD(started_at)       OVER w AS to_started_at
    FROM exp
    WINDOW w AS (PARTITION BY user_id ORDER BY started_at, COALESCE(ended_at, DATE '9999-12-31'))
  )
  SELECT
    p.user_id,
    p.company_id, p.to_company_id, p.company_text, p.to_company_text,
    p.role_category_id, p.to_role_category_id,
    cf.industry, ct.industry,
    p.to_started_at AS moved_at,
    CASE WHEN u.birth_date IS NULL THEN NULL
         ELSE EXTRACT(YEAR FROM AGE(p.to_started_at, u.birth_date))::int
    END,
    GREATEST(0, EXTRACT(YEAR FROM AGE(p.to_started_at, fs.career_start))::int),
    CASE WHEN p.role_category_id IS NULL OR p.to_role_category_id IS NULL THEN 'unknown'
         WHEN p.role_category_id <> p.to_role_category_id THEN 'changed'
         ELSE 'unchanged' END,
    /* ★両側がマスタ紐づけで、かつ industry が入っているときだけ判定する。
       片側でも自由入力なら unknown。2値に潰さない。 */
    CASE WHEN cf.industry IS NULL OR ct.industry IS NULL THEN 'unknown'
         WHEN cf.industry <> ct.industry THEN 'changed'
         ELSE 'unchanged' END
  FROM pairs p
  JOIN public.ow_users u  ON u.id = p.user_id
  JOIN first_start fs     ON fs.user_id = p.user_id
  LEFT JOIN public.ow_companies cf ON cf.id = p.company_id
  LEFT JOIN public.ow_companies ct ON ct.id = p.to_company_id
  WHERE p.to_ckey IS NOT NULL
    AND p.to_ckey <> p.ckey;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.rebuild_ow_transitions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_ow_transitions() TO service_role;

DO $$
DECLARE v_new int; v_old int; v_def text;
BEGIN
  SELECT count(*) INTO v_new FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_transitions'
     AND column_name IN ('role_change','industry_change');
  SELECT count(*) INTO v_old FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_transitions'
     AND column_name IN ('is_role_change','is_industry_change');
  IF v_new <> 2 OR v_old <> 0 THEN
    RAISE EXCEPTION '改名できていない（新 % / 旧 %）。中止', v_new, v_old;
  END IF;

  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
   WHERE pronamespace='public'::regnamespace AND proname='rebuild_ow_transitions';
  IF v_def ~ '\mis_role_change\M' OR v_def ~ '\mis_industry_change\M' THEN
    RAISE EXCEPTION '洗い替え関数に旧列名が残っている。中止';
  END IF;
  IF v_def !~ 'DELETE FROM public.ow_transitions WHERE true' THEN
    RAISE EXCEPTION 'WHERE true が消えている。中止';
  END IF;

  RAISE NOTICE '改名完了: role_change / industry_change。関数も作り直した';
END $$;

COMMIT;
