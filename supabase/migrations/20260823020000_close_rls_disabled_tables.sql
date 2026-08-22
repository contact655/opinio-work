-- ============================================================================
-- RLS が無効で anon から読めていた2表を塞ぐ
--
-- 2026-08-23。届出のための調査（フェーズ0）で見つかった。
-- **public スキーマ 137表のうち、この2表だけ RLS が無効だった。**
--
-- ⚠️ **とくに ow_company_reviews_archive_20260714 は実害があった。**
--    未ログイン（anon キー）で PostgREST を直接叩くと **29行すべてが 200 で返り**、
--    うち24件は口コミ本文（pros）を持っていた。company_id・employment_status
--    （現職/元社員）・job_type（職種）と同時に取れるため、
--    **規模の小さい企業では書いた人が推測されうる**状態だった。
--    （user_id は全件 NULL なので直接の特定はできない）
--    プライバシーポリシー第10項「アクセス制御（Row Level Security）」の
--    記載とも食い違っていた。
--
-- ⚠️ ow_company_employee_categories は個人情報ではない（企業ページの
--    「現役社員」カテゴリの並び順。5行）。**それでも同じ形で塞ぐ。**
--    RLS 無効の表を例外として残すと、次に増やすときの前例になる。
--
-- ── 塞いでも壊れないことの確認（適用前に実施）──────────────────────────
--   ① src からの参照は**両表ともサービスロール経由だけ**
--      ・ow_company_employee_categories … queries.ts:1746 の
--        getCompanyEmployeeCategories と /api/biz/company/employee-categories
--        の2ルートは、いずれも createAdminClient()。
--        **service_role は RLS も GRANT も迂回する**ので影響しない。
--      ・ow_company_reviews_archive_20260714 … 参照0件（口コミ機能は存在しない）
--   ② **この2表を副問い合わせしている RLS ポリシーは0本。**
--      （CLAUDE.md「ポリシー式は実行ユーザーの権限で評価される」——
--       参照している表から SELECT を剥がすと無関係な表が 403 になる罠。
--       今回は該当なしを確認済み）
--   ③ 関数本文からの参照は merge_role の1本のみ。
--      SECURITY DEFINER / 所有者 postgres / EXECUTE は service_role だけ。
--      **postgres は表の所有者なので RLS を迂回する**（FORCE 未設定）。
--
-- ── 作り方の根拠 ────────────────────────────────────────────────────────
-- CLAUDE.md「**誰にも読ませないは GRANT で、誰に読ませるかは RLS で書く**」。
--   ・anon           … GRANT を剥がす（読ませる相手ではないので RLS に載せない）
--   ・authenticated  … **GRANT は残す**。ここを剥がすと RLS まで到達せず、
--                      **運営（admin も authenticated ロールで来る）でも読めなくなる**。
--                      2026-08-16 に ow_settings で実際に踏んで戻した事故と同じ形。
--   ・RLS            … admin だけに SELECT を開く1本
-- 既存の同型は ow_settings（anon=m / authenticated=arwdm / RLS 有効）。**これに揃えた。**
--
-- ⚠️ **SELECT ポリシーしか置かない＝INSERT/UPDATE/DELETE は塞がる。**
--    RLS は「ポリシーが無い操作は拒否」なので、authenticated が持っている
--    a/w/d の GRANT は RLS に阻まれて通らなくなる。**これは意図した結果。**
--    アプリの書き込みは service_role なので影響しない（上の①）。
--
-- ⚠️ **データは1行も変更しない。** 出どころの調査が終わるまで消さない。
--
-- ── 復元用 ──────────────────────────────────────────────────────────────
-- ALTER TABLE public.ow_company_reviews_archive_20260714 DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.ow_company_employee_categories      DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS ow_company_reviews_archive_20260714_select_admin
--   ON public.ow_company_reviews_archive_20260714;
-- DROP POLICY IF EXISTS ow_company_employee_categories_select_admin
--   ON public.ow_company_employee_categories;
-- GRANT SELECT ON TABLE public.ow_company_reviews_archive_20260714 TO anon;
-- GRANT SELECT ON TABLE public.ow_company_employee_categories      TO anon;
-- ============================================================================

-- ── ① 適用前の検算：前提が変わっていたら止める ────────────────────────────
DO $$
DECLARE
  v_archive_rows int;
  v_cat_rows     int;
BEGIN
  SELECT count(*) INTO v_archive_rows FROM public.ow_company_reviews_archive_20260714;
  SELECT count(*) INTO v_cat_rows     FROM public.ow_company_employee_categories;

  RAISE NOTICE '適用前: アーカイブ %行 / カテゴリ %行 / anon SELECT = % , %',
    v_archive_rows, v_cat_rows,
    has_table_privilege('anon','public.ow_company_reviews_archive_20260714','SELECT'),
    has_table_privilege('anon','public.ow_company_employee_categories','SELECT');

  -- ⚠️ 行数が変わっていたら、調査対象が別物になっている。止めて確認する
  IF v_archive_rows <> 29 THEN
    RAISE EXCEPTION 'アーカイブが29行ではない（%行）。出どころ調査の前提が変わっている', v_archive_rows;
  END IF;
END $$;

-- ── ② anon から SELECT を剥がす ────────────────────────────────────────────
-- ⚠️ anon には INSERT/UPDATE/DELETE が元から無い（ACL は anon=rm）。
--    r（SELECT）だけを落とし、m（MAINTAIN）は他表と揃えて残す。
REVOKE SELECT ON TABLE public.ow_company_reviews_archive_20260714 FROM anon;
REVOKE SELECT ON TABLE public.ow_company_employee_categories      FROM anon;

-- ── ③ RLS を有効化し、admin だけに読ませる ────────────────────────────────
ALTER TABLE public.ow_company_reviews_archive_20260714 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ow_company_employee_categories      ENABLE ROW LEVEL SECURITY;

-- ⚠️ ロールを指定しない（= PUBLIC 宛）。ow_settings_select_admin と同じ形。
--    GRANT が無い anon はそもそもここへ到達しないので、実質 authenticated 向け。
CREATE POLICY ow_company_reviews_archive_20260714_select_admin
  ON public.ow_company_reviews_archive_20260714
  FOR SELECT USING (public.auth_is_admin());

CREATE POLICY ow_company_employee_categories_select_admin
  ON public.ow_company_employee_categories
  FOR SELECT USING (public.auth_is_admin());

COMMENT ON TABLE public.ow_company_reviews_archive_20260714 IS
  '2026-07-14 に退避した口コミデータ29行。**口コミ機能は存在しない。** '
  '2026-08-23 まで RLS 無効・anon から SELECT 可能で、未ログインの外部から '
  '本文・企業ID・在籍区分・職種が読めていた。同日に anon の GRANT を剥がし、'
  'RLS を有効化して運営のみ読める形にした。出どころの調査が終わるまで削除しない。';

-- ── ④ 適用後の検算 ────────────────────────────────────────────────────────
-- ⚠️ これは catalog を見ているだけ。**実際の応答は適用後に anon キーで
--    PostgREST を直接叩いて確かめること**（CLAUDE.md）。
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ow_company_reviews_archive_20260714',
                           'ow_company_employee_categories']
  LOOP
    IF has_table_privilege('anon', 'public.'||t, 'SELECT') THEN
      RAISE EXCEPTION '% : anon がまだ SELECT できる', t;
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.'||t, 'SELECT') THEN
      RAISE EXCEPTION '% : authenticated の SELECT が落ちている（運営が読めなくなる）', t;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class
             WHERE oid = ('public.'||t)::regclass) THEN
      RAISE EXCEPTION '% : RLS が有効になっていない', t;
    END IF;
    IF (SELECT count(*) FROM pg_policy WHERE polrelid = ('public.'||t)::regclass) <> 1 THEN
      RAISE EXCEPTION '% : ポリシーが1本ではない', t;
    END IF;
    RAISE NOTICE '% : anon=false / authenticated=true / RLS=on / ポリシー1本 ✓', t;
  END LOOP;

  -- ⚠️ 行数が変わっていないこと（このmigrationはデータを触らない）
  IF (SELECT count(*) FROM public.ow_company_reviews_archive_20260714) <> 29
     OR (SELECT count(*) FROM public.ow_company_employee_categories) <> 5 THEN
    RAISE EXCEPTION 'データが変わっている。このmigrationは行を触ってはいけない';
  END IF;
END $$;
