-- ============================================================================
-- 孤児になった get_tenant_id() を落とす
--
-- 2026-08-23。旧ATSの44表を落とした（20260823060000）ことで、
-- **本文が参照する `agents` 表が存在しなくなった。**
--
--   CREATE FUNCTION public.get_tenant_id() RETURNS uuid
--   LANGUAGE sql SECURITY DEFINER AS $$
--     SELECT tenant_id FROM agents WHERE auth_user_id = auth.uid() LIMIT 1;
--   $$;
--
-- ── 呼び出し元が無いことの確認（DROP 直前に取り直した）────────────────
-- **7経路すべてで0件。**
--   ポリシー / 関数 / ビュー / トリガー / 列のデフォルト値 / CHECK制約 / インデックス
--   ⚠️ 陽性対照として同じ7経路で `auth_is_admin` を探すと
--      ポリシー31・関数1、`now()` は列のデフォルト値158に当たる。**検出は効いている。**
--
--   もともとの呼び出し元は**44表自身の `tenant_isolation` ポリシー14本だけ**で、
--   表と一緒に消えている。
--
--   アプリからの参照も0件（`types.ts` に RPC の型が載っているが自動生成。
--   `baseline.sql` の記述は履歴）。
--
-- ⚠️ **この関数は anon にも EXECUTE が配られていた**（baseline の
--    `GRANT ALL ON FUNCTION ... TO anon`）。SECURITY DEFINER なので、
--    落とすことで PostgREST の RPC 面も1つ減る。
--
-- ⚠️ **CASCADE は使わない。** 依存が残っていれば落ちてほしい。
--
-- ── 復元 ────────────────────────────────────────────────────────────────
-- 定義は上のコメントのとおり。ただし `agents` 表が無いので、
-- **戻すなら表ごと戻すことになる**（.dumps/20260823-0031-*.sql）。
-- ============================================================================

-- ── ① 呼び出し元が無いことを DB 側でも確かめてから落とす ────────────────
DO $$
DECLARE
  v int := 0;
BEGIN
  SELECT count(*) INTO v FROM pg_policy p
   WHERE coalesce(pg_get_expr(p.polqual,p.polrelid),'')
      || coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') ~ '\mget_tenant_id\M';
  IF v > 0 THEN RAISE EXCEPTION 'ポリシー%件がまだ get_tenant_id を呼んでいる', v; END IF;

  SELECT count(*) INTO v FROM pg_proc p
   WHERE p.prokind='f' AND p.proname <> 'get_tenant_id'
     AND p.pronamespace='public'::regnamespace
     AND pg_get_functiondef(p.oid) ~ '\mget_tenant_id\M';
  IF v > 0 THEN RAISE EXCEPTION '関数%件がまだ get_tenant_id を呼んでいる', v; END IF;

  SELECT count(*) INTO v FROM pg_attrdef d
   WHERE pg_get_expr(d.adbin, d.adrelid) ~ '\mget_tenant_id\M';
  IF v > 0 THEN RAISE EXCEPTION '列のデフォルト値%件がまだ get_tenant_id を呼んでいる', v; END IF;

  RAISE NOTICE '呼び出し元 0件を確認';
END $$;

-- ── ② DROP ──────────────────────────────────────────────────────────────
DROP FUNCTION public.get_tenant_id();

-- ── ③ 検算 ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_fn int;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_tenant_id') THEN
    RAISE EXCEPTION 'get_tenant_id がまだ存在する';
  END IF;

  -- ⚠️ 巻き添えが無いこと。実測（2026-08-23 適用前）: public の関数は38本
  SELECT count(*) INTO v_fn FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f';
  IF v_fn <> 37 THEN
    RAISE EXCEPTION 'public の関数が37本ではない（%本）。巻き添えの疑い', v_fn;
  END IF;

  RAISE NOTICE 'get_tenant_id を削除。public の関数 %本（38 → 37）', v_fn;
END $$;
