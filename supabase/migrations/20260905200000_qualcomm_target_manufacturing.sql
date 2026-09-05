-- ============================================================================
-- クアルコムジャパンの対象業界を「製造業」にする
--   —— 業種を2階層にしたことで、初めて分類できるようになった1社
--
-- 作業前ダンプ: .dumps/20260905-1544-ow_industries-ow_companies-ow_company_target_industries.sql
-- ============================================================================
--
-- ── なぜ今まで未確認だったか ──────────────────────────────────────────────
-- 2026-09-04 のフェーズ3で、この1社だけ `target_industry_scope = NULL`（未確認）で
-- 残した。理由は「**顧客が複数の製造業にまたがる**」——語彙が
-- 電機・機械 / 素材・化学 / 食品・飲料 / 電子機器・半導体 に割れており、
--   ・1つ選ぶと嘘になる
--   ・複数選ぶと「業界を問わない（horizontal）」と区別がつかなくなる
-- 2026-09-05 に「製造業」の親ができたので、**そのまま言える**ようになった。
--
-- ── 根拠 ──────────────────────────────────────────────────────────────────
-- 自社の description（既にDBにある。出典は公式サイト https://www.qualcomm.com/company/locations/japan）:
--   「スマートフォン向けSnapdragonプロセッサで世界シェアを誇る半導体設計企業の日本法人。
--     5G基地局向けチップ・IoT・**車載**（Snapdragon Ride）・**PC**プラットフォームにも展開する
--     ファブレス半導体企業。」
-- → 売り先はスマートフォン・自動車・PC の**メーカー**。**製造業向け（vertical）**。
--
-- ⚠️ `horizontal`（業界を問わない）ではない。**作る会社にしか売っていない。**
-- ⚠️ `consumer` でもない。半導体を消費者に直接売っていない。
--
-- ⚠️★**子（電子機器・半導体）にしないこと。** それだと「半導体メーカー向け」になり、
--    車載・PC が落ちる。**親のままが正しい。**
--    ⚠️ 突合は**本人側だけ**を祖先展開するので、親に付けても
--       「電機・機械」出身の人には当たる（実測済み）。企業側は展開しない。

BEGIN;

DO $$
DECLARE v_scope text; v_n int;
BEGIN
  SELECT target_industry_scope INTO v_scope FROM public.ow_companies
   WHERE name = 'クアルコムジャパン合同会社';
  IF v_scope IS NOT NULL THEN
    RAISE EXCEPTION 'クアルコムの対象業界が既に「%」。上書きしないので中止', v_scope;
  END IF;

  SELECT count(*) INTO v_n FROM public.ow_industries WHERE slug='manufacturing' AND is_active;
  IF v_n <> 1 THEN RAISE EXCEPTION '「製造業」が見つからない。先に2階層化の migration を当てること'; END IF;
END $$;

/* ⚠️ RPC を通す。`ow_company_target_industries` は
      `(company_id, target_industry_scope) → ow_companies(id, target_industry_scope)` の
      **複合FK**で「明細を持てるのは vertical の企業だけ」を担保しているので、
      scope と明細を別々に書くと順序次第で弾かれる。 */
SELECT public.set_company_target_industries(
  (SELECT id FROM public.ow_companies WHERE name = 'クアルコムジャパン合同会社'),
  'vertical',
  ARRAY[(SELECT id FROM public.ow_industries WHERE slug = 'manufacturing')],
  (SELECT id FROM public.ow_industries WHERE slug = 'manufacturing')
);

DO $$
DECLARE v_n int; v_name text;
BEGIN
  SELECT count(*), string_agg(i.name, ' / ') INTO v_n, v_name
    FROM public.ow_company_target_industries t
    JOIN public.ow_industries i ON i.id = t.industry_id
    JOIN public.ow_companies c ON c.id = t.company_id
   WHERE c.name = 'クアルコムジャパン合同会社';
  IF v_n <> 1 OR v_name <> '製造業' THEN
    RAISE EXCEPTION '対象業界が「製造業」1件になっていない（% 件: %）', v_n, v_name;
  END IF;

  -- ★掲載中で対象業界が未確認の企業が1社減ったこと
  SELECT count(*) INTO v_n FROM public.ow_companies
   WHERE is_published AND listing_status='listed' AND NOT coalesce(is_test,false)
     AND target_industry_scope IS NULL;
  RAISE NOTICE '事後チェック OK: クアルコム→製造業(vertical) / 未確認の掲載企業は残り % 社', v_n;
END $$;

COMMIT;
