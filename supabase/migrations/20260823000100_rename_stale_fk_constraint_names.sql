-- ============================================================================
-- リネームで取り残された制約名を実体に合わせる
--
-- ⚠️ **実害は無い。** ただ `types.ts` に `ow_tenant_plans_tenant_id_fkey` として
--    残っており、**次に読む人が `tenants` テーブルを見に行く。**
--    テーブルと列を改名した目的（2026-08-22）がここで台無しになる。
--
--    PostgreSQL は ALTER TABLE ... RENAME で制約名を追随させないので、
--    明示的に改名する必要がある。
--
-- ── 復元用 ──────────────────────────────────────────────────────────────
-- ALTER TABLE public.ow_company_plans
--   RENAME CONSTRAINT ow_company_plans_company_id_fkey TO ow_tenant_plans_tenant_id_fkey;
-- ALTER TABLE public.ow_company_plans
--   RENAME CONSTRAINT ow_company_plans_pkey_new TO ow_tenant_plans_pkey;
-- （※ 実際に改名するのは下に書いたものだけ。存在しないものは触らない）
-- ============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass::text AS tbl,
           replace(c.conname, 'ow_tenant_plans_', 'ow_company_plans_') AS newname
      FROM pg_constraint c
     WHERE c.connamespace = 'public'::regnamespace
       AND c.conname LIKE 'ow_tenant_plans_%'
  LOOP
    /* tenant_id → company_id も一緒に直す（FK の制約名に列名が入っているため） */
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
                   r.tbl, r.conname, replace(r.newname, '_tenant_id_', '_company_id_'));
    RAISE NOTICE '改名: % -> %', r.conname, replace(r.newname, '_tenant_id_', '_company_id_');
  END LOOP;
END $$;

-- ── 検算 ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_stale int;
BEGIN
  SELECT count(*) INTO v_stale
    FROM pg_constraint
   WHERE connamespace = 'public'::regnamespace
     AND conname LIKE 'ow_tenant_plans_%';

  IF v_stale > 0 THEN
    RAISE EXCEPTION '旧名の制約が % 本残っている', v_stale;
  END IF;

  RAISE NOTICE '旧名の制約は0本';
END $$;
