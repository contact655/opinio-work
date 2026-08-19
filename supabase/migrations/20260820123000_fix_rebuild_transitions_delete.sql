-- ═══════════════════════════════════════════════════════════════════════════
-- rebuild_ow_transitions(): WHERE の無い DELETE を直す（2026-08-20）
--
-- ⚠️ `20260820120000` で入れた関数は `DELETE FROM public.ow_transitions;` と
--    書いていたため、**PostgREST 経由（RPC）で呼ぶと 21000 で必ず落ちた**:
--      「DELETE requires a WHERE clause」
--    Supabase は `safeupdate` を有効にしており、WHERE の無い DELETE / UPDATE を弾く。
--    **SQL エディタや psql から直接呼ぶと通る**ので、
--    「関数を作った」だけでは気づけない。**RPC で1回叩くまでが1セット。**
--
-- 関数の中身はそれ以外まったく同じ（全件洗い替え・冪等）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.rebuild_ow_transitions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_count integer;
BEGIN
  /* ⚠️ 全件洗い替え。**冪等**（2回流しても同じ結果になる）。
        差分更新にしないのは、隣接ペアが前後の行に依存するため。 */
  /* ⚠️ **`WHERE true` を省かない**（2026-08-20）。Supabase の PostgREST 経由では
        `safeupdate` が効いており、WHERE の無い DELETE は 21000
        「DELETE requires a WHERE clause」で弾かれる。
        SQL で直接呼ぶと通るので、**RPC で呼ぶまで気づけない。** */
  DELETE FROM public.ow_transitions WHERE true;

  INSERT INTO public.ow_transitions (
    user_id,
    from_company_id, to_company_id, from_company_text, to_company_text,
    from_role_category_id, to_role_category_id,
    from_industry, to_industry,
    moved_at, age_at_move, years_of_experience_at_move,
    is_role_change, is_industry_change
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
    /* 並びは started_at。同じ月に始まった行は ended_at の早いほうを先にする
       （在籍が終わっていない行を後ろに置く）。 */
    WINDOW w AS (PARTITION BY user_id ORDER BY started_at, COALESCE(ended_at, DATE '9999-12-31'))
  )
  SELECT
    p.user_id,
    p.company_id, p.to_company_id, p.company_text, p.to_company_text,
    p.role_category_id, p.to_role_category_id,
    cf.industry, ct.industry,
    p.to_started_at AS moved_at,
    /* 年齢。誕生日が来ていなければ1引く。birth_date が無ければ NULL */
    CASE WHEN u.birth_date IS NULL THEN NULL
         ELSE EXTRACT(YEAR FROM AGE(p.to_started_at, u.birth_date))::int
    END,
    /* 社会人年数。最も古い在籍開始から moved_at まで。マイナスにはしない */
    GREATEST(0, EXTRACT(YEAR FROM AGE(p.to_started_at, fs.career_start))::int),
    /* 職種は ow_experiences で NOT NULL なので基本は判定できる。
       それでも unknown を持つのは、将来 NULL 可になったときに
       静かに unchanged へ倒れないようにするため。 */
    CASE WHEN p.role_category_id IS NULL OR p.to_role_category_id IS NULL THEN 'unknown'
         WHEN p.role_category_id <> p.to_role_category_id THEN 'changed'
         ELSE 'unchanged' END,
    /* ★業種は**両側がマスタ紐づけで、かつ industry が入っているときだけ**判定する。
       片側でも自由入力なら unknown。ここを2値にすると異業界転職が少なく出る。 */
    CASE WHEN cf.industry IS NULL OR ct.industry IS NULL THEN 'unknown'
         WHEN cf.industry <> ct.industry THEN 'changed'
         ELSE 'unchanged' END
  FROM pairs p
  JOIN public.ow_users u  ON u.id = p.user_id
  JOIN first_start fs     ON fs.user_id = p.user_id
  LEFT JOIN public.ow_companies cf ON cf.id = p.company_id
  LEFT JOIN public.ow_companies ct ON ct.id = p.to_company_id
  WHERE p.to_ckey IS NOT NULL
    /* ★会社が変わったペアだけ。同じ会社での役割変更は転職ではない。 */
    AND p.to_ckey <> p.ckey;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.rebuild_ow_transitions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_ow_transitions() TO service_role;

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
   WHERE pronamespace='public'::regnamespace AND proname='rebuild_ow_transitions';
  IF v_def !~ 'DELETE FROM public.ow_transitions WHERE true' THEN
    RAISE EXCEPTION 'WHERE true が入っていない。中止';
  END IF;
  IF has_function_privilege('anon','public.rebuild_ow_transitions()','EXECUTE')
     OR has_function_privilege('authenticated','public.rebuild_ow_transitions()','EXECUTE') THEN
    RAISE EXCEPTION '洗い替え関数が anon / authenticated から実行できる。中止';
  END IF;
  RAISE NOTICE 'rebuild_ow_transitions: WHERE true あり / 実行権限は service_role のみ';
END $$;

COMMIT;
