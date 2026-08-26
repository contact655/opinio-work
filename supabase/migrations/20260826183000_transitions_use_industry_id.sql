-- ow_transitions の業界判定を industry_id（業種マスタ）に移す（2026-08-26）
--
-- 経緯:
--   `rebuild_ow_transitions()` は `ow_companies.industry`(text) を読んでいた。
--   この列は 2026-08-25 に書き込み経路を閉じた**廃止予定の列**で、
--   以降に作られる企業では NULL。放置すると新しい企業が絡む転職が
--   **静かに 'unknown' に落ちる**（かつ industry(text) を DROP できない）。
--
-- ⚠️ 旧 `industry`(text) は名前に反して**業界ではなく製品・業務領域**だった
--    （CRM・営業支援 / クラウドインフラ / コラボレーション）。
--    `industry_change` という名前と意味がずれていたので、
--    業種マスタ（`ow_industries`・20値）に揃える。
--
-- ⚠️ **結果は変わる。** 実測（本番5行）で2行が 'changed' → 'unchanged' になる:
--      セールスフォース → 伊藤忠テクノソリューションズ（CRM・営業支援 → クラウドインフラ）
--      富士フイルムBI   → セールスフォース（コラボレーション → CRM・営業支援）
--    どちらも業種は IT・ソフトウェア同士なので、**訂正であって劣化ではない。**
--    「領域は変わったが業界は変わっていない」を区別したくなったら、
--    事業領域（ow_company_business_domains）を使う別の列を足すこと。
--    **この列に混ぜないこと**（名前と意味がまたずれる）。
--
-- ⚠️ 比較は id で行う（名前の表記ゆれに影響されない）。
--    from_industry / to_industry には**業種マスタの名前**を入れる（列型は text のまま）。

create or replace function public.rebuild_ow_transitions()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

comment on column public.ow_companies.industry is
  '【廃止】2026-08-25 に書き込み経路を閉じ、2026-08-26 に最後の読み手（rebuild_ow_transitions）を industry_id へ移した。読み書きしないこと。';
