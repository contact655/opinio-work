-- ============================================================================
-- 企業名の重複照合を「別名」まで広げる
--   find_companies_by_normalized_name が name だけでなく
--   brand_name / name_en / search_aliases も見るようにする
--
-- 作業前ダンプ: .dumps/20260905-1458-ow_companies.sql
-- 調査: docs/phase0-company-name-normalization-20260905.md
-- ============================================================================
--
-- ── なぜ ──────────────────────────────────────────────────────────────────
-- 実測（2026-09-05 / 掲載83社に機械生成した表記で照会）:
--
--   正式名称 / 法人格外し / 全角英数 / 大小文字 / （株）表記 / ナカグロ抜き … 一致率 100%
--   英語名（name_en） ………………………………………………………………… 27.8%
--   ブランド名（brand_name） ……………………………………………………… 10.0%
--   読み仮名（search_aliases） …………………………………………………… ★0.0%
--
-- **正規化が担当する範囲は既に 100%。伸びしろは無い。穴は別名側だった。**
--
-- 実害の形（アンドパッド）:
--   株式会社アンドパッド  brand_name='ANDPAD'  normalized_name='アンドパッド'
--     ・企業ピッカー（ILIKE で brand_name も見る） → 「ANDPAD」で**見つかる**
--     ・重複検出（normalized_name のみ）            → 「ANDPAD」で**見つからない**
--   ＝ 登録ダイアログで「ANDPAD」と打つと、重複に気づけないまま2社目が作られる。
--
-- ── ⚠️★normalize_company_name は一切変更しない ──────────────────────────────
-- あの関数は**重複検出専用ではない**。`can_send_scout` と `get_blocked_companies`
-- （＝**スカウトのブロック判定**）も使っている。
-- **重複検出の都合で正規化を緩めると、ブロック判定まで一緒に動く。**
-- だから別名の照合は**この関数の中だけ**で行い、正規化そのものには触らない。
--
-- ⚠️ 別名の値にも `normalize_company_name` を**掛けて比べる**（ANDPAD と andpad を
--    一致させるため）。掛けるだけで、関数の中身は変えていない。
--
-- ⚠️★**完全一致にする。** 部分一致にしない —— 「もしかしてこれ？」が候補で溢れる。
--    部分一致はピッカー（ILIKE）の仕事で、あちらは**確定させない**。
--
-- ⚠️★**`search_aliases` は配列ではなく text（空白区切り）**（2026-09-05 実測）。
--    列の COMMENT にも「検索専用の別名（空白区切り）」と書いてある。
--    実データ: `サンプルワークス SampleWorks` のように空白で並ぶ。
--    **正規化は空白を除去するので、先に分割してから正規化すること。**
--    まとめて掛けると `サンプルワークスsampleworks` という無意味な1語になる。

BEGIN;

-- ── 0. 事前チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_acl_public boolean; v_dep int;
BEGIN
  -- ⚠️ 依存しているオブジェクトが無いこと（DROP して作り直すため）
  SELECT count(*) INTO v_dep FROM pg_proc
   WHERE pronamespace='public'::regnamespace
     AND proname <> 'find_companies_by_normalized_name'
     AND pg_get_functiondef(oid) ~ '\mfind_companies_by_normalized_name\M';
  IF v_dep > 0 THEN RAISE EXCEPTION 'この関数に依存する関数が % 本ある。中止', v_dep; END IF;

  /* ⚠️★**EXECUTE は PUBLIC に配られている**（2026-09-05 実測。ACL の `=X/postgres`）。
        「service_role だけ」ではない。**この状態を変えない**ので、作り直したあとも
        PUBLIC のままにする（新規関数の既定が PUBLIC EXECUTE なので、そのままでよい）。
     ⚠️ 漏れない理由: この関数は **SECURITY INVOKER**（`prosecdef = false`）なので
        RLS が呼び出し側の権限で効く。実測でも anon から未掲載企業（鹿島建設）は
        0件で、掲載中（Salesforce）だけが返った。 */
  SELECT has_function_privilege('anon', p.oid, 'EXECUTE') INTO v_acl_public
    FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
     AND p.proname='find_companies_by_normalized_name';
  IF v_acl_public IS NOT TRUE THEN
    RAISE EXCEPTION 'anon の EXECUTE が既に外れている。権限の前提が変わったので中止';
  END IF;
END $$;

-- ── 1. 戻り値に matched_on を足すので、作り直す ────────────────────────────
--   ⚠️ `CREATE OR REPLACE` では戻り値の型を変えられない。DROP してから作る。
--   ⚠️ CASCADE は使わない（依存は0本と確認済み）。
DROP FUNCTION IF EXISTS public.find_companies_by_normalized_name(text);

CREATE FUNCTION public.find_companies_by_normalized_name(p_name text)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  is_published boolean,
  is_approved boolean,
  source text,
  canonical_company_id uuid,
  created_at timestamptz,
  /* ★どの列で一致したか。'name' / 'brand_name' / 'name_en' / 'search_aliases'。
     ⚠️ 運営メールの［重複の疑い］と「もしかしてこれ？」で
        **なぜ候補に出たのか**を出すために足した（2026-09-05）。
     ⚠️ 画面にこの値を生で出さないこと（実装語）。表示用の文言に畳んでから出す。 */
  matched_on text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH q AS (SELECT public.normalize_company_name(p_name) AS n)
  SELECT c.id, c.name, c.slug, c.is_published, c.is_approved,
         c.source, c.canonical_company_id, c.created_at,
         m.matched_on
    FROM public.ow_companies c
    CROSS JOIN q
    /* ⚠️ LATERAL ＋ LIMIT 1 が絞り込みも兼ねる（どれとも一致しない企業は行が出ない）。
          ⚠️ 優先順は name → brand_name → name_en → search_aliases。
             複数で一致したときに**理由が実行ごとに変わらない**ようにするため。 */
    CROSS JOIN LATERAL (
      SELECT x.matched_on
        FROM (
          -- ① 正式名称（列に持っている正規化値をそのまま使う）
          SELECT 1 AS ord, 'name'::text AS matched_on, c.normalized_name AS v
          -- ② ブランド名
          UNION ALL
          SELECT 2, 'brand_name', public.normalize_company_name(c.brand_name)
          -- ③ 英語名
          UNION ALL
          SELECT 3, 'name_en', public.normalize_company_name(c.name_en)
          -- ④ 読み仮名（★空白区切りの text。**先に分割してから正規化する**）
          UNION ALL
          SELECT 4, 'search_aliases', public.normalize_company_name(t.tok)
            FROM regexp_split_to_table(coalesce(c.search_aliases, ''), '[[:space:]　]+') AS t(tok)
        ) x
       WHERE x.v IS NOT NULL AND x.v = q.n
       ORDER BY x.ord
       LIMIT 1
    ) m
   WHERE q.n IS NOT NULL
   ORDER BY c.created_at
$function$;

COMMENT ON FUNCTION public.find_companies_by_normalized_name(text) IS
  '企業名の重複照合。正式名称だけでなく **brand_name / name_en / search_aliases** も見る（2026-09-05）。'
  '⚠ 完全一致。部分一致にしないこと（「もしかしてこれ？」が候補で溢れる。部分一致はピッカーの ILIKE の仕事）。'
  '⚠ search_aliases は配列ではなく **空白区切りの text**。正規化は空白を除去するので、**先に分割してから**正規化する。'
  '⚠ matched_on はどの列で一致したかを返す（name / brand_name / name_en / search_aliases）。実装語なので画面に生で出さない。'
  '⚠ SECURITY INVOKER。RLS が呼び出し側の権限で効く（anon からは掲載中の企業しか返らない）。'
  '⚠★normalize_company_name には触っていない。あの関数は can_send_scout / get_blocked_companies'
  '（スカウトのブロック判定）も使っており、重複検出の都合で緩めるとブロック判定まで動く。';

/* ⚠️ ACL を元に戻す。DROP で消えるので明示する。
      新規関数の既定で PUBLIC に EXECUTE が付くため、**元の状態（PUBLIC ＋ service_role）と同じ**。 */
GRANT EXECUTE ON FUNCTION public.find_companies_by_normalized_name(text) TO service_role;

-- ── 2. 事後チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_n int; v_names text;
BEGIN
  -- ★「ANDPAD」で 株式会社アンドパッド が brand_name 経由で1社返ること
  SELECT count(*), string_agg(name || '(' || matched_on || ')', ' / ')
    INTO v_n, v_names
    FROM public.find_companies_by_normalized_name('ANDPAD');
  IF v_n <> 1 OR v_names NOT LIKE '%アンドパッド(brand_name)%' THEN
    RAISE EXCEPTION 'ANDPAD の照会が想定と違う（% 件: %）', v_n, v_names;
  END IF;

  -- ★「アサナ」で Asana Japan が search_aliases 経由で1社返ること
  SELECT count(*), string_agg(name || '(' || matched_on || ')', ' / ')
    INTO v_n, v_names
    FROM public.find_companies_by_normalized_name('アサナ');
  IF v_n <> 1 OR v_names NOT LIKE '%Asana%(search_aliases)%' THEN
    RAISE EXCEPTION 'アサナ の照会が想定と違う（% 件: %）', v_n, v_names;
  END IF;

  -- 正式名称でも今までどおり1社返り、理由が name であること
  SELECT count(*), string_agg(matched_on, ',')
    INTO v_n, v_names
    FROM public.find_companies_by_normalized_name('鹿島建設株式会社');
  IF v_n <> 1 OR v_names <> 'name' THEN
    RAISE EXCEPTION '正式名称の照会が想定と違う（% 件: %）', v_n, v_names;
  END IF;

  -- ★別名が NULL の企業で例外にならないこと（該当社数を数えるだけで落ちないことを確認）
  PERFORM public.find_companies_by_normalized_name('存在しない社名テスト12345');

  -- ★過剰一致していないこと: 掲載中の企業を正式名称で総当たりして、2社以上返る組が無いこと
  SELECT count(*) INTO v_n FROM (
    SELECT c.id, (SELECT count(*) FROM public.find_companies_by_normalized_name(c.name)) AS hits
      FROM public.ow_companies c
     WHERE c.is_published AND c.listing_status='listed' AND NOT coalesce(c.is_test,false)
  ) s WHERE s.hits <> 1;
  IF v_n <> 0 THEN
    RAISE EXCEPTION '掲載中の企業のうち % 社が、自分の正式名称で 1 社以外を返す（過剰一致）', v_n;
  END IF;

  RAISE NOTICE '事後チェック OK: ANDPAD→brand_name / アサナ→search_aliases / 総当たりの過剰一致 0 件';
END $$;

COMMIT;
