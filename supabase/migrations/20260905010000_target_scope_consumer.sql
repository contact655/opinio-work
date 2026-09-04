-- ============================================================================
-- 対象業界の状態に 'consumer'（消費者向け）を足し、未確認11社を判定する
--
-- ── なぜ4つ目の値を足すか ───────────────────────────────────────────────────
-- 「調べた結果、**消費者向け**だった」は**記録すべき事実**であって、未確認ではない。
-- NULL に置き続けると、運営が毎回同じ会社を開いて
-- 「これは判断できないやつだ」と思い出すコストを払い続ける（柴さん / 2026-09-04）。
--
-- ⚠️★**`horizontal` に入れてはいけない。** あれは「あらゆる**業界の企業**に売っている」
--    という意味で、消費者向けをそこに入れると嘘になる。
--
-- ⚠️ 明細は持てない。複合FK（`ow_cti_company_scope_fkey`）が
--    「明細を持てるのは `vertical` だけ」を構造で担保しているので、
--    **`consumer` を足しても明細がぶら下がる余地は生まれない。**
--
-- ⚠️★**表示側で `vertical` と同じ扱いにしないこと**（あとで別の見せ方をする余地を残す）。
--
-- ── 3層を揃える（CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）────────────
--   ① DB の CHECK          … このファイル
--   ② 定数                 … src/lib/companies/targetIndustries.ts
--   ③ UI のラジオ          … src/app/admin/companies/[id]/CompanyDetailClient.tsx
--   ＋ RPC set_company_target_industries の p_scope 検証もこのファイルで直す
--
-- 作業前ダンプ: .dumps/20260904-2158-ow_companies-ow_company_target_industries.sql
-- ============================================================================

BEGIN;

-- ── 0. 事前チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_null int; v_h int;
BEGIN
  SELECT count(*) INTO v_null FROM public.ow_companies
   WHERE listing_status='listed' AND coalesce(is_test,false)=false AND target_industry_scope IS NULL;
  IF v_null <> 11 THEN RAISE EXCEPTION '未確認が 11 社でない（% 社）。適用済みの可能性', v_null; END IF;

  SELECT count(*) INTO v_h FROM public.ow_companies
   WHERE listing_status='listed' AND coalesce(is_test,false)=false AND target_industry_scope='horizontal';
  IF v_h <> 63 THEN RAISE EXCEPTION 'horizontal が 63 社でない（% 社）', v_h; END IF;
END $$;

-- ── 1. CHECK を3値 + NULL → 4値 + NULL へ ─────────────────────────────────
ALTER TABLE public.ow_companies
  DROP CONSTRAINT ow_companies_target_industry_scope_check;

ALTER TABLE public.ow_companies
  ADD CONSTRAINT ow_companies_target_industry_scope_check
  CHECK (target_industry_scope IS NULL
         OR target_industry_scope IN ('vertical', 'horizontal', 'consumer'));

COMMENT ON COLUMN public.ow_companies.target_industry_scope IS
  '対象業界（軸2）の状態。vertical=特定業界に張っている（明細1〜3件）/ horizontal=業界を問わない（企業向け・明細0件）/ consumer=消費者向け（明細0件）/ NULL=未確認。⚠ horizontal・consumer・NULL は別物（前2つは運営が判断した結果、NULL は未着手）。⚠★consumer を horizontal に混ぜないこと（「あらゆる業界の企業に売っている」が嘘になる）。⚠ 明細は ow_company_target_industries。持てるのは vertical だけで、複合FKが構造で担保している。⚠★運営専用。authenticated に UPDATE の GRANT を配っていない';

-- ── 2. RPC の検証も4値へ ──────────────────────────────────────────────────
--   ⚠️ 「vertical 以外は明細を持てない」の判定は `IS DISTINCT FROM 'vertical'` なので
--      consumer も自動的に含まれる。直すのは受け付ける値の一覧だけ。
CREATE OR REPLACE FUNCTION public.set_company_target_industries(
  p_company_id          uuid,
  p_scope               text,
  p_industry_ids        uuid[],
  p_primary_industry_id uuid
) RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_ids   uuid[];
  v_count integer;
  v_valid integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ow_companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION '企業が見つかりません' USING ERRCODE = '22023';
  END IF;

  IF p_scope IS NOT NULL AND p_scope NOT IN ('vertical', 'horizontal', 'consumer') THEN
    RAISE EXCEPTION '対象業界の状態は vertical / horizontal / consumer / NULL のいずれかです'
      USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(array_agg(DISTINCT d), '{}'::uuid[])
    INTO v_ids
    FROM unnest(coalesce(p_industry_ids, '{}'::uuid[])) AS d;
  v_count := coalesce(array_length(v_ids, 1), 0);

  -- vertical 以外は明細を持てない（consumer もここに入る）
  IF p_scope IS DISTINCT FROM 'vertical' AND v_count > 0 THEN
    RAISE EXCEPTION '「業界を問わない」「消費者向け」「未確認」のときは対象業界を指定できません'
      USING ERRCODE = '22023';
  END IF;

  IF p_scope = 'vertical' AND v_count = 0 THEN
    RAISE EXCEPTION '「特定の業界に張っている」を選んだときは、対象業界を1つ以上選んでください'
      USING ERRCODE = '22023';
  END IF;

  IF v_count > 0 THEN
    SELECT count(*) INTO v_valid
      FROM ow_industries WHERE id = ANY(v_ids) AND is_active = true;
    IF v_valid <> v_count THEN
      RAISE EXCEPTION '業種マスタに無い、または無効な id が含まれています'
        USING ERRCODE = '22023';
    END IF;

    IF p_primary_industry_id IS NULL THEN
      RAISE EXCEPTION '主の対象業界を1つ選んでください' USING ERRCODE = '22023';
    END IF;
    IF NOT (p_primary_industry_id = ANY(v_ids)) THEN
      RAISE EXCEPTION '主の対象業界は、選んだ対象業界の中から指定してください'
        USING ERRCODE = '22023';
    END IF;
  ELSIF p_primary_industry_id IS NOT NULL THEN
    RAISE EXCEPTION '対象業界が0件のときは主を指定できません' USING ERRCODE = '22023';
  END IF;

  -- ⚠️★順序は固定（明細を消す → scope を書く → 明細を入れる）
  DELETE FROM ow_company_target_industries WHERE company_id = p_company_id;
  UPDATE ow_companies SET target_industry_scope = p_scope WHERE id = p_company_id;

  IF v_count > 0 THEN
    INSERT INTO ow_company_target_industries (company_id, industry_id, is_primary, display_order)
    SELECT p_company_id, m.id, (m.id = p_primary_industry_id),
           row_number() OVER (ORDER BY (m.id = p_primary_industry_id) DESC, m.display_order, m.name)
      FROM ow_industries m WHERE m.id = ANY(v_ids);
  END IF;

  RETURN v_count;
END $$;

COMMENT ON FUNCTION public.set_company_target_industries(uuid, text, uuid[], uuid) IS
  '企業の対象業界（軸2）を入れ替える。⚠★順序が固定: 明細を消す → scope を書く → 明細を入れる（複合FK の ON UPDATE RESTRICT のため逆順は必ず落ちる）。⚠ 受け付ける scope は vertical / horizontal / consumer / NULL。⚠ 1社あたりの上限（3件）はここで見ない（API 側で検証する）。⚠ SECURITY INVOKER のままにすること';

-- ⚠️ EXECUTE は service_role だけ（CREATE OR REPLACE で権限は引き継がれるが明示しておく）
REVOKE ALL ON FUNCTION public.set_company_target_industries(uuid, text, uuid[], uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_company_target_industries(uuid, text, uuid[], uuid) FROM anon;
REVOKE ALL ON FUNCTION public.set_company_target_industries(uuid, text, uuid[], uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_target_industries(uuid, text, uuid[], uuid)
  TO service_role;

-- ── 3. 未確認11社のうち9社を判定する ──────────────────────────────────────
--
--   horizontal 7社。判定の理由は docs/target-industry-classification-20260904.md。
--   ⚠️「強い業界がある」は特化ではない（SAP / IBM / パランティア）。
--   ⚠️ irodas の「新卒採用」は**採用の種類**であって業界ではない。
--   ⚠️ アリスタの「超大手ハイパースケーラー」は**企業規模**の話。
UPDATE public.ow_companies
   SET target_industry_scope = 'horizontal'
 WHERE name IN (
   'SAPジャパン株式会社',
   'インテル株式会社',
   'パランティア・テクノロジーズ',
   '日本IBM株式会社',
   '株式会社irodas',
   '株式会社シンカ',
   'アリスタネットワークス合同会社'
 );

--   consumer 2社。★主な売り先が消費者。
UPDATE public.ow_companies
   SET target_industry_scope = 'consumer'
 WHERE name IN ('アップルジャパン合同会社', 'ウーバー・ジャパン株式会社');

-- ── 4. 残る2社は未確認のまま（理由を残す）─────────────────────────────────
--   ⚠️ クアルコムジャパン … 顧客は製造業だが、**その語彙が無い**。
--      「電機・機械」「素材・化学」「食品・飲料」に割れており、
--      **製造業の2階層化（親「製造業」＋祖先展開）を待つ。**
--      → 語彙ができたら **vertical になる会社**として docs に名指しで記録してある。
--   ⚠️ 株式会社タイミー … description に顧客の業種が1つも無い。
--      **埋めてから判定する。** 企業データ充填のリストに載せてある。
--      ⚠️ 推測で埋めない（実際には飲食・小売・物流が中心と思われるが、本文に無い）。

-- ── 5. 事後チェック ────────────────────────────────────────────────────────
DO $$
DECLARE v_h int; v_c int; v_v int; v_null int; v_t int; v_bad int;
BEGIN
  SELECT count(*) INTO v_h FROM public.ow_companies
   WHERE listing_status='listed' AND coalesce(is_test,false)=false AND target_industry_scope='horizontal';
  IF v_h <> 70 THEN RAISE EXCEPTION 'horizontal が 70 社でない（% 社）', v_h; END IF;

  SELECT count(*) INTO v_c FROM public.ow_companies
   WHERE listing_status='listed' AND coalesce(is_test,false)=false AND target_industry_scope='consumer';
  IF v_c <> 2 THEN RAISE EXCEPTION 'consumer が 2 社でない（% 社）', v_c; END IF;

  SELECT count(*) INTO v_v FROM public.ow_companies
   WHERE listing_status='listed' AND coalesce(is_test,false)=false AND target_industry_scope='vertical';
  IF v_v <> 9 THEN RAISE EXCEPTION 'vertical が 9 社でない（% 社）', v_v; END IF;

  SELECT count(*) INTO v_null FROM public.ow_companies
   WHERE listing_status='listed' AND coalesce(is_test,false)=false AND target_industry_scope IS NULL;
  IF v_null <> 2 THEN RAISE EXCEPTION '未確認が 2 社でない（% 社）', v_null; END IF;

  -- 明細は増えも減りもしない（9行のまま）
  SELECT count(*) INTO v_t FROM public.ow_company_target_industries;
  IF v_t <> 9 THEN RAISE EXCEPTION '対象業界の明細が 9 行でない（% 行）', v_t; END IF;

  -- ★vertical 以外に明細がぶら下がっていないこと（複合FKが担保しているはずだが実測する）
  SELECT count(*) INTO v_bad FROM public.ow_company_target_industries t
    JOIN public.ow_companies c ON c.id = t.company_id
   WHERE c.target_industry_scope IS DISTINCT FROM 'vertical';
  IF v_bad <> 0 THEN RAISE EXCEPTION 'vertical でない企業に明細が % 行ぶら下がっている', v_bad; END IF;

  RAISE NOTICE '事後チェック OK: horizontal % / consumer % / vertical % / 未確認 %', v_h, v_c, v_v, v_null;
END $$;

COMMIT;
