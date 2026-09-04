-- ============================================================================
-- 対象業界（軸2）の器を作る — フェーズ1
--
--   軸1 = 事業領域（何を作っているか / ow_business_domains）… 2026-08-25 に作成
--   軸2 = 対象業界（誰に売っているか / ここ）                  … このファイル
--
-- ⚠️★**このフェーズでは値を1件も入れない。** 表示・突合・検索にも繋がない。
--    入れた値がどこにも出ない状態で終わるのが正しい（事業領域を作った日と同じ形）。
--
-- ── なぜ ow_industries を共有するか ─────────────────────────────────────────
-- **出身業界と対象業界が同じ ID で繋がることが、この機能の前提。**
-- 求職者の職歴 → 勤務先 → `ow_companies.industry_id` → `ow_industries.id` と辿った
-- ID が、そのまま企業側の「誰に売っているか」の ID と一致することで突合が成立する。
-- 別マスタにすると対応表が要り、語彙がずれた瞬間に静かに0件になる。
--
-- ⚠️★**したがって、ここに語彙を足すときは粒度を割らないこと。**
--    例: 対象業界にだけ「製造業（一般）」を作ると、出身企業が持つ
--    `machinery`（電機・機械）と**別 ID になり、永久にマッチしない。**
--    正しい形は「製造業」を親、machinery / materials-chemicals / food-beverage を
--    子にした2階層 ＋ 祖先展開（`expandWithAncestors` と同じ）で、
--    2階層UIの作り直しを伴うため**別タスク**。当面は該当する子を複数選ぶ。
--
-- ⚠️ `ow_companies.market_industry_focus`（text[]・CHECK 9語）は**使わない・消さない**。
--    参照0件の死蔵列として据え置く。建設が語彙に無く、ow_industries と繋がらない。
--
-- 作業前ダンプ: .dumps/20260904-1347-ow_industries-ow_companies.sql
--               （ow_industries 20行 / ow_companies 90行 / スキーマ+データ）
-- ============================================================================

BEGIN;

-- ── 0. 事前チェック（想定と違えば中止）──────────────────────────────────────
DO $$
DECLARE v_rc int; v_scope int; v_tbl int;
BEGIN
  -- 「不動産・建設」を分割してよいのは、使っている企業が0社のときだけ
  SELECT count(*) INTO v_rc FROM public.ow_companies c
    JOIN public.ow_industries i ON i.id = c.industry_id
   WHERE i.slug = 'realestate-construction';
  IF v_rc <> 0 THEN
    RAISE EXCEPTION '「不動産・建設」を使っている企業が % 社ある。付け替え先の判断が要るので中止', v_rc;
  END IF;

  SELECT count(*) INTO v_scope FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_companies' AND column_name='target_industry_scope';
  IF v_scope <> 0 THEN
    RAISE EXCEPTION 'target_industry_scope が既にある。適用済みの可能性。中止';
  END IF;

  SELECT count(*) INTO v_tbl FROM information_schema.tables
   WHERE table_schema='public' AND table_name='ow_company_target_industries';
  IF v_tbl <> 0 THEN
    RAISE EXCEPTION 'ow_company_target_industries が既にある。適用済みの可能性。中止';
  END IF;
END $$;

-- ── 1. 語彙を2件だけ足す ────────────────────────────────────────────────────
--
--   ⚠️ **物理DELETE しない。** 選択肢マスタは `is_active = false` の論理削除が正。
--   ⚠️ 「実データが1社以上ある値だけ作る」は **facet の表示側の規約**であって、
--      マスタに値を持たないという意味ではない。軸2は今フェーズで表示しないので抵触しない。
--      **表示フェーズでは同じ規約が効く**ので、企業を入れるまで「建設」は選択肢に出ない。

-- ①「不動産・建設」→「不動産」と「建設」に分割（使用0社を上で確認済み）
--   ⚠️ 束のままだと、アンドパッド（建設）といい生活（不動産）が同じ値になる。
UPDATE public.ow_industries
   SET is_active = false, display_order = 99
 WHERE slug = 'realestate-construction';

COMMENT ON TABLE public.ow_industries IS
  '業種マスタ。⚠★**「自社がどの業界の会社か」と「誰に売っているか（対象業界）」の両方で共有する。** 出身業界と対象業界が同じ id で繋がることが突合の前提。⚠★**粒度を割らないこと。** 片方にだけ粗い値（例:「製造業」）を作ると別 id になり永久にマッチしない。粗い区分が要るなら2階層＋祖先展開にする（別タスク）。⚠ 値を消すときは is_active = false の論理削除。物理DELETEは使わない';

INSERT INTO public.ow_industries (name, slug, display_order, is_active, requires_business_domain) VALUES
  ('不動産',    'realestate',   13, true, false),
  ('建設',      'construction', 14, true, false),
  -- ②「飲食・外食」を新設。⚠️ `food-beverage`（食品・飲料）はメーカー側で別物
  ('飲食・外食', 'food-service',  9, true, false);

-- 並び順を明示列挙で整える。⚠️ 一括 UPDATE にせず slug を全部書く
UPDATE public.ow_industries AS i
   SET display_order = v.ord
  FROM (VALUES
    ('it-software', 1), ('internet-web', 2), ('electronics-semiconductor', 3),
    ('telecom', 4), ('machinery', 5), ('materials-chemicals', 6),
    ('energy-infrastructure', 7), ('food-beverage', 8), ('food-service', 9),
    ('trading-wholesale', 10), ('retail-distribution', 11), ('finance-insurance', 12),
    ('realestate', 13), ('construction', 14), ('logistics', 15),
    ('healthcare', 16), ('education', 17), ('hr-services', 18),
    ('consulting', 19), ('media-advertising-entertainment', 20),
    ('public-organization', 21), ('other-services', 22)
  ) AS v(slug, ord)
 WHERE i.slug = v.slug;

COMMENT ON COLUMN public.ow_industries.slug IS
  '安定キー。⚠ `food-beverage` は食品・飲料の**メーカー側**、`food-service` は**外食・飲食店**。別物なので統合しないこと。⚠ `realestate-construction`（不動産・建設）は 2026-09-04 に不動産と建設へ分割し、is_active = false にした行';

-- ── 2. 企業側の3値 ─────────────────────────────────────────────────────────
--
--   vertical    … 特定の業界に張っている（明細1〜3件を持つ）
--   horizontal  … 業界を問わない（明細0件）。★**空欄ではなく、運営が判断した結果**
--   NULL        … 未確認（まだ調べていない）
--
--   ⚠️ horizontal と NULL を同じものとして扱わないこと。前者は「調べて、業界を
--      問わないと分かった」で、後者は「まだ誰も見ていない」。運営の作業一覧は
--      NULL だけを残すために使う。
ALTER TABLE public.ow_companies
  ADD COLUMN target_industry_scope text;

ALTER TABLE public.ow_companies
  ADD CONSTRAINT ow_companies_target_industry_scope_check
  CHECK (target_industry_scope IS NULL OR target_industry_scope IN ('vertical', 'horizontal'));

COMMENT ON COLUMN public.ow_companies.target_industry_scope IS
  '対象業界（軸2）の状態。vertical=特定業界に張っている（明細1〜3件）/ horizontal=業界を問わない（明細0件）/ NULL=未確認。⚠ horizontal と NULL は別物（前者は運営が判断した結果、後者は未着手）。⚠ 明細は ow_company_target_industries。⚠★**運営専用。`authenticated` に UPDATE の GRANT を配っていない**（入力は /admin のみ）。/biz に開く日は grant update (target_industry_scope) が要る';

-- 複合FK の参照先。⚠️ id は主キーなので実質いつでも一意だが、
--    FK は「参照する列の組にちょうど一致する一意制約」を要求するので明示的に張る。
ALTER TABLE public.ow_companies
  ADD CONSTRAINT ow_companies_id_target_scope_key UNIQUE (id, target_industry_scope);

-- ⚠️★`grant update (target_industry_scope)` は**あえて書かない。**
--    `ow_companies` はテーブルレベル UPDATE を落として列単位で配り直しており
--    （実測 2026-09-04: 152列中147列に authenticated の UPDATE）、
--    書かなければ **authenticated から更新できない列として生まれる。**
--    入力は /admin（service_role）だけと決めたので、これが意図した状態。
--    ⚠️ 配っていない他の4列: canonical_company_id / is_approved / is_test /
--       normalized_name / search_aliases（＝運営専用の列と同じ扱い）。

-- ── 3. 明細（中間表）──────────────────────────────────────────────────────
CREATE TABLE public.ow_company_target_industries (
  company_id            uuid        NOT NULL,
  industry_id           uuid        NOT NULL REFERENCES public.ow_industries(id) ON DELETE RESTRICT,
  is_primary            boolean     NOT NULL DEFAULT false,
  display_order         integer     NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),

  -- ★この列の値に意味は無い。**構造を守るためだけに置いている。**（下の COMMENT 参照）
  target_industry_scope text        NOT NULL DEFAULT 'vertical'
                                    CONSTRAINT ow_cti_scope_is_vertical
                                    CHECK (target_industry_scope = 'vertical'),

  CONSTRAINT ow_company_target_industries_pkey PRIMARY KEY (company_id, industry_id),

  -- ★複合FK。**「明細を持てるのは scope='vertical' の企業だけ」をDBで担保する。**
  --   ・horizontal / 未確認(NULL) の企業には、そもそも一致する親行が無いので INSERT できない
  --   ・明細が残ったまま scope を動かすと ON UPDATE RESTRICT が止める
  --   ⚠️ トリガーにしなかったのは、テーブル定義を読んでも気づけない隠れた挙動を
  --      増やさないため（`guard_member_consent` を「ポリシーだけ読んで」誤読した前例）。
  CONSTRAINT ow_cti_company_scope_fkey
    FOREIGN KEY (company_id, target_industry_scope)
    REFERENCES public.ow_companies (id, target_industry_scope)
    ON UPDATE RESTRICT ON DELETE CASCADE
);

COMMENT ON TABLE public.ow_company_target_industries IS
  '企業 × 対象業界（軸2 = 誰に売っているか）。⚠★**軸1（事業領域 / ow_company_business_domains）とは別物。** あちらは「何を作っているか」。⚠★語彙は ow_industries を**自社の業種と共有**している。出身業界と対象業界が同じ id で繋がることが突合の前提で、**粒度が割れると繋がらない**（対象業界にだけ「製造業」を作ると、出身企業が持つ machinery と別 id になり永久にマッチしない）。粗い区分が要るなら2階層＋祖先展開にすること。⚠ 1社あたりの上限（3件）は API 側で検証する。⚠ 主分類は is_primary（部分UNIQUEで1社1件をDBが担保）。⚠「vertical なのに明細0件」はDBでは担保できない（行をまたぐ個数のため）。API の400と /admin/companies の一覧で見つける';

COMMENT ON COLUMN public.ow_company_target_industries.target_industry_scope IS
  '常に ''vertical''。ow_companies との複合FKで「明細を持てるのは vertical の企業だけ」を担保するための列。**値としての意味は無い。**⚠ 読み書きしないこと。⚠ 消すと horizontal / 未確認 の企業に明細がぶら下がれるようになる';

-- 「主は1社1件」を DB で担保する（事業領域と同じ形）
CREATE UNIQUE INDEX ow_company_target_industries_one_primary
  ON public.ow_company_target_industries (company_id) WHERE is_primary;

-- ⚠️ `industry_id` 側のインデックスは**あえて張らない**（過剰インデックスの件。
--    ユーザーテーブル10MB中インデックスが6MB / 411本。数十行の表では Seq Scan が速い）。

-- ── 4. RLS ────────────────────────────────────────────────────────────────
--    ⚠️ **`FOR ALL` を使わない。** 4種を個別に書き、WITH CHECK も明示する。
ALTER TABLE public.ow_company_target_industries ENABLE ROW LEVEL SECURITY;

-- anon は**公開企業に限定**する（`USING (true)` にしない）
CREATE POLICY company_target_industries_anon_read ON public.ow_company_target_industries
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.ow_companies c
     WHERE c.id = company_id AND c.is_published = true AND c.is_test = false
  ));

CREATE POLICY company_target_industries_auth_read ON public.ow_company_target_industries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ow_companies c
       WHERE c.id = company_id AND c.is_published = true AND c.is_test = false
    )
    OR public.auth_is_company_admin(company_id)
    OR public.auth_is_admin()
  );

-- ⚠️ 書き込みは**運営だけ**。軸1と違い `auth_is_company_admin` を入れていないのは、
--    入力を /admin に限ると決めたため（/biz に開く日にここも足す）。
CREATE POLICY company_target_industries_admin_insert ON public.ow_company_target_industries
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_admin());

CREATE POLICY company_target_industries_admin_update ON public.ow_company_target_industries
  FOR UPDATE TO authenticated
  USING      (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE POLICY company_target_industries_admin_delete ON public.ow_company_target_industries
  FOR DELETE TO authenticated
  USING (public.auth_is_admin());

-- ── 5. GRANT ──────────────────────────────────────────────────────────────
--    ⚠️ 新しいテーブルには既定で権限が付かない。書かないと誰も読めない。
--    ⚠️ 運営も `authenticated` ロールで来る。ここを配らないと RLS まで到達しない。
GRANT SELECT                 ON public.ow_company_target_industries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ow_company_target_industries TO authenticated;

-- ── 6. 入れ替え RPC（1トランザクション）────────────────────────────────────
--    ⚠️ アプリから DELETE / UPDATE / INSERT を別々に叩かないこと。supabase-js の
--       呼び出しは1回ずつ別トランザクションなので、途中で落ちると中途半端に残る。
--    ⚠️★**順序が固定されている**（複合FK の ON UPDATE RESTRICT のため）:
--         ① 明細を消す → ② scope を書く → ③ 明細を入れる
--       逆順にすると「明細が残ったまま scope を動かす」ことになり、**必ず落ちる**。
--    ⚠️ SECURITY INVOKER（既定）のままにする。DEFINER にすると RLS を素通りする。
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

  IF p_scope IS NOT NULL AND p_scope NOT IN ('vertical', 'horizontal') THEN
    RAISE EXCEPTION '対象業界の状態は vertical / horizontal / NULL のいずれかです'
      USING ERRCODE = '22023';
  END IF;

  -- 重複を落とす（同じ業界を2回送られても1行にする）
  SELECT coalesce(array_agg(DISTINCT d), '{}'::uuid[])
    INTO v_ids
    FROM unnest(coalesce(p_industry_ids, '{}'::uuid[])) AS d;
  v_count := coalesce(array_length(v_ids, 1), 0);

  -- vertical 以外は明細を持てない
  IF p_scope IS DISTINCT FROM 'vertical' AND v_count > 0 THEN
    RAISE EXCEPTION '「業界を問わない」「未確認」のときは対象業界を指定できません'
      USING ERRCODE = '22023';
  END IF;

  -- ⚠️「vertical なのに明細0件」はここで止める（DBの制約では書けないため）
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

  -- ① 明細を消す（⚠️ `WHERE true` ではなく company_id で必ず絞る）
  DELETE FROM ow_company_target_industries WHERE company_id = p_company_id;

  -- ② scope を書く（①の後でないと ON UPDATE RESTRICT に止められる）
  UPDATE ow_companies SET target_industry_scope = p_scope WHERE id = p_company_id;

  -- ③ 明細を入れる
  IF v_count > 0 THEN
    INSERT INTO ow_company_target_industries (company_id, industry_id, is_primary, display_order)
    SELECT p_company_id,
           m.id,
           (m.id = p_primary_industry_id),
           row_number() OVER (ORDER BY (m.id = p_primary_industry_id) DESC, m.display_order, m.name)
      FROM ow_industries m
     WHERE m.id = ANY(v_ids);
  END IF;

  RETURN v_count;
END $$;

COMMENT ON FUNCTION public.set_company_target_industries(uuid, text, uuid[], uuid) IS
  '企業の対象業界（軸2）を入れ替える。⚠★順序が固定: 明細を消す → scope を書く → 明細を入れる（複合FK の ON UPDATE RESTRICT のため逆順は必ず落ちる）。⚠ 1社あたりの上限（3件）はここで見ない（API 側で検証する）。⚠ SECURITY INVOKER のままにすること';

-- ⚠️★**`authenticated` には EXECUTE を配らない**（事業領域の RPC とここが違う）。
--    配ると「呼べるのに必ず失敗する関数」になる ——
--    この関数は `ow_companies.target_industry_scope` を UPDATE するが、
--    その列の UPDATE は列単位 GRANT を**あえて配っていない**ので 42501 で落ちる。
--    ⚠️ /biz に開く日は **EXECUTE と 列の GRANT の両方**が要る。片方だけでは動かない。
REVOKE ALL ON FUNCTION public.set_company_target_industries(uuid, text, uuid[], uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_company_target_industries(uuid, text, uuid[], uuid) FROM anon;
REVOKE ALL ON FUNCTION public.set_company_target_industries(uuid, text, uuid[], uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_target_industries(uuid, text, uuid[], uuid)
  TO service_role;

-- ── 7. 事後チェック（★「エラーが出なかった」を成功にしない）────────────────
DO $$
DECLARE
  v_active int; v_new int; v_rows int; v_pol int; v_scope_ok boolean;
BEGIN
  SELECT count(*) INTO v_active FROM public.ow_industries WHERE is_active = true;
  IF v_active <> 22 THEN
    RAISE EXCEPTION '有効な業種が 22 件になっていない（% 件）', v_active;
  END IF;

  SELECT count(*) INTO v_new FROM public.ow_industries
   WHERE slug IN ('realestate', 'construction', 'food-service') AND is_active;
  IF v_new <> 3 THEN
    RAISE EXCEPTION '新しい3件が入っていない（% 件）', v_new;
  END IF;

  IF EXISTS (SELECT 1 FROM public.ow_industries WHERE slug='realestate-construction' AND is_active) THEN
    RAISE EXCEPTION '「不動産・建設」が有効なまま残っている';
  END IF;

  -- 明細は0件で終わる（このフェーズでは値を入れない）
  SELECT count(*) INTO v_rows FROM public.ow_company_target_industries;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION '明細が % 行ある。このフェーズでは0件で終わるはず', v_rows;
  END IF;

  -- scope は全社 NULL（未確認）で始まる
  IF EXISTS (SELECT 1 FROM public.ow_companies WHERE target_industry_scope IS NOT NULL) THEN
    RAISE EXCEPTION 'target_industry_scope に値が入っている企業がある';
  END IF;

  -- RLS ポリシーが5本（anon read / auth read / insert / update / delete）
  SELECT count(*) INTO v_pol FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname = 'ow_company_target_industries';
  IF v_pol <> 5 THEN
    RAISE EXCEPTION 'RLS ポリシーが 5 本でない（% 本）', v_pol;
  END IF;

  -- ⚠️ GRANT は catalog を見るだけでは足りないが、最低限ここで測る
  SELECT has_table_privilege('anon','public.ow_company_target_industries','SELECT')
    INTO v_scope_ok;
  IF NOT v_scope_ok THEN
    RAISE EXCEPTION 'anon に SELECT の GRANT が無い';
  END IF;

  RAISE NOTICE '事後チェック OK: 有効な業種 % 件 / 明細 % 行 / ポリシー % 本', v_active, v_rows, v_pol;
END $$;

COMMIT;
