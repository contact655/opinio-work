-- ════════════════════════════════════════════════════════════════════════
-- 遷移（ow_transitions）の洗い替えから、統計利用を停止した人などを外す（2026-10-26 / フェーズ1a-2）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★きっかけ: docs/phase0-decision-platform-20261026.md の A4・C11。
--    rebuild_ow_transitions() は検証用とシステムだけを外しており、
--    ① 統計利用を停止した人（ow_users.statistics_opt_out。規約 第13条の4 第5項）を外していなかった
--    ② 本人が登録していない行（auth_id IS NULL）が3行混ざっていた
--    ③ 非公開（visibility = 'private'）の人も入っていた
--    アプリの集計は lib/aggregate/population.ts の isAggregatableUser で同じ5条件を外すので、SQL 側も揃える。
--
-- ★変えるのは関数の WHERE だけ。CREATE OR REPLACE なので GRANT（service_role と postgres のみ）は保たれる。
--    ⚠️ DROP FUNCTION にしないこと（作り直すと PUBLIC の EXECUTE が既定で付く）。
-- ★最後に1回洗い替える（導出表なので、元の ow_experiences は変えない）。
--
-- 作業前の実測（2026-10-26）: ow_transitions 20行（実ユーザー17・auth_id が null の人3・検証用0）。
--    statistics_opt_out = true の人は0人なので、変わるのは auth_id が null の3行（20 → 17 の見込み）。
-- 作業前の控え: .dumps/ の ow_transitions（このファイルと同じ日付）
-- 戻し方: 下の関数から 3つの条件（statistics_opt_out / auth_id / visibility）を外して作り直し、洗い替える。
-- ════════════════════════════════════════════════════════════════════════

begin;

CREATE OR REPLACE FUNCTION public.rebuild_ow_transitions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    /* ★集計の母数から外す人（lib/aggregate/population.ts の isAggregatableUser と同じ。2026-10-26）。
          ⚠️ 片方だけ変えないこと（アプリの集計と SQL の集計で数がずれる）。 */
    WHERE COALESCE(u.is_test, false) = false
      AND COALESCE(u.is_system, false) = false
      AND u.auth_id IS NOT NULL
      AND COALESCE(u.visibility, '') <> 'private'
      AND u.statistics_opt_out = false
      AND COALESCE(u.email, '') NOT ILIKE '%@seed.internal'
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
    /* ⚠️ 業種マスタの名前を入れる。`ow_companies.industry`(text) は廃止済みなので読まない。 */
    ifr.name, itr.name,
    p.to_started_at AS moved_at,
    CASE WHEN u.birth_date IS NULL THEN NULL
         ELSE EXTRACT(YEAR FROM AGE(p.to_started_at, u.birth_date))::int
    END,
    GREATEST(0, EXTRACT(YEAR FROM AGE(p.to_started_at, fs.career_start))::int),
    CASE WHEN p.role_category_id IS NULL OR p.to_role_category_id IS NULL THEN 'unknown'
         WHEN p.role_category_id <> p.to_role_category_id THEN 'changed'
         ELSE 'unchanged' END,
    /* ★両側がマスタ紐づけで、かつ業種が入っているときだけ判定する。
       片側でも自由入力なら unknown。2値に潰さない。
       ⚠️ 比較は id。名前で比べない（表記が変わると判定が変わる）。 */
    CASE WHEN cf.industry_id IS NULL OR ct.industry_id IS NULL THEN 'unknown'
         WHEN cf.industry_id <> ct.industry_id THEN 'changed'
         ELSE 'unchanged' END
  FROM pairs p
  JOIN public.ow_users u  ON u.id = p.user_id
  JOIN first_start fs     ON fs.user_id = p.user_id
  LEFT JOIN public.ow_companies cf ON cf.id = p.company_id
  LEFT JOIN public.ow_companies ct ON ct.id = p.to_company_id
  LEFT JOIN public.ow_industries ifr ON ifr.id = cf.industry_id
  LEFT JOIN public.ow_industries itr ON itr.id = ct.industry_id
  WHERE p.to_ckey IS NOT NULL
    AND p.to_ckey <> p.ckey;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

select public.rebuild_ow_transitions();

do $$
declare n int; bad int;
begin
  select count(*) into n from public.ow_transitions;
  select count(*) into bad from public.ow_transitions t join public.ow_users u on u.id = t.user_id
   where u.statistics_opt_out or u.auth_id is null or u.is_test or u.is_system;
  if bad <> 0 then raise exception '外すはずの人の行が % 行残っている', bad; end if;
  raise notice 'ow_transitions % 行', n;
end $$;

commit;
