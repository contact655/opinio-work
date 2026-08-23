-- ============================================================================
-- 書き込みポリシーが1本も無い3表から、authenticated の書き込み GRANT を剥がす
--
-- 2026-08-23。RLS ポリシーの横断点検で見つかった。
--
-- ⚠️ **現在は書けない**（RLS は「ポリシーが無い操作は拒否」）。
--    ただし **GRANT だけが残っている**ので、**誰かがポリシーを1本足した瞬間に開く。**
--    ow_jobs / ow_user_roles と同じ形の事故を、先に材料の側で潰しておく。
--
-- ── 対象 ────────────────────────────────────────────────────────────────
--   ow_articles      … 書込ポリシー0本。書き込みは /admin/articles（service_role）のみ
--   ow_company_plans … 書込ポリシー0本。書き込みは /admin/plans と
--                      POST /api/biz/companies（いずれも admin クライアント）
--   ow_invoices      … 書込ポリシー0本。**src に書き込み経路が1つも無い**
--
-- ⚠️ **`ow_posts` は対象から外した。** 投稿機能が実在し、
--    `POST /api/jobseeker/posts`（insert）と `DELETE /api/jobseeker/posts/[id]`
--    が**利用者セッション**で書いている。ポリシーも `posts_insert_own` /
--    `posts_delete_own` の2本がある。剥がすと投稿できなくなる。
--    （UPDATE のポリシーは無いので投稿の編集は元からできない。これは現状のまま）
--
-- ⚠️ **service_role は残す。** アプリの書き込みはすべてこちら。
-- ⚠️ **anon の SELECT は触らない。** `ow_articles` は記事の公開表示に使う。
--
-- ── 復元用 ──────────────────────────────────────────────────────────────
-- GRANT INSERT, UPDATE, DELETE ON TABLE public.ow_articles      TO authenticated;
-- GRANT INSERT, UPDATE, DELETE ON TABLE public.ow_company_plans TO authenticated;
-- GRANT INSERT, UPDATE, DELETE ON TABLE public.ow_invoices      TO authenticated;
-- ============================================================================

-- ── ① 適用前の検算：書込ポリシーが本当に0本か ──────────────────────────
DO $$
DECLARE r record; v int;
BEGIN
  FOR r IN SELECT unnest(ARRAY['ow_articles','ow_company_plans','ow_invoices']) AS t
  LOOP
    SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
     WHERE c.relname = r.t AND p.polcmd IN ('a','w','d','*');
    IF v <> 0 THEN
      RAISE EXCEPTION '% に書込ポリシーが%本ある。剥がすと壊れる可能性がある', r.t, v;
    END IF;
  END LOOP;

  -- ow_posts は逆に「ポリシーがあること」を確かめる（対象外である根拠）
  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_posts' AND p.polcmd IN ('a','d');
  IF v <> 2 THEN
    RAISE EXCEPTION 'ow_posts の INSERT/DELETE ポリシーが2本ではない（%本）', v;
  END IF;

  RAISE NOTICE '3表とも書込ポリシー0本 / ow_posts は2本（対象外）';
END $$;

-- ── ② 剥がす ────────────────────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE ON TABLE public.ow_articles      FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.ow_company_plans FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.ow_invoices      FROM authenticated;

-- ── ③ 適用後の検算 ──────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT unnest(ARRAY['ow_articles','ow_company_plans','ow_invoices']) AS t
  LOOP
    IF has_table_privilege('authenticated','public.'||r.t,'INSERT')
       OR has_table_privilege('authenticated','public.'||r.t,'UPDATE')
       OR has_table_privilege('authenticated','public.'||r.t,'DELETE') THEN
      RAISE EXCEPTION '% にまだ書き込み権限が残っている', r.t;
    END IF;
    -- ⚠️ SELECT は残すこと（企業がプランを見る / 記事を読む）
    IF NOT has_table_privilege('authenticated','public.'||r.t,'SELECT') THEN
      RAISE EXCEPTION '% の SELECT まで剥がれている', r.t;
    END IF;
    IF NOT has_table_privilege('service_role','public.'||r.t,'INSERT') THEN
      RAISE EXCEPTION '% の service_role の書き込みが剥がれている', r.t;
    END IF;
  END LOOP;

  -- ow_posts は無傷であること
  IF NOT has_table_privilege('authenticated','public.ow_posts','INSERT')
     OR NOT has_table_privilege('authenticated','public.ow_posts','DELETE') THEN
    RAISE EXCEPTION 'ow_posts の権限を巻き添えにしている';
  END IF;

  RAISE NOTICE '3表: authenticated の書き込みなし / SELECT あり / service_role あり。ow_posts 無傷';
END $$;
