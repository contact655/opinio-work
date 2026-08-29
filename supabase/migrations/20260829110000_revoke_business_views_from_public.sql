-- ═══════════════════════════════════════════════════════════════════════════
-- BIZ 用ビュー3つを service_role 限定にする ── 情報漏れの是正（2026-08-29）
--
-- ── ★何が漏れていたか（実測 / 2026-08-29）────────────────────────────────
-- baseline（`20260727000000`）が3ビューに **`GRANT ALL ... TO anon`** を付けており、
-- ビューは `OWNER TO postgres` で `security_invoker` **ではない**ため
-- **下層テーブルの RLS を迂回**していた。
--
-- 結果、**公開されている anon キーだけで**次が取れた:
--
--   ow_business_job_performance  200 / **20行**
--     → 全社の求人。**うち draft が15件**（非公開求人のタイトルが読める）
--     → 列: job_id, tenant_id, title, status, created_at,
--            view_count, application_count, conversion_rate_pct
--   ow_business_todo_counts      200 / **89行**（全社の返信遅延・新規応募の件数）
--   ow_business_monthly_stats    200 / 0行（今は空だが同じ状態）
--
-- ⚠️ **画面は正しく作られていた**（`.eq("tenant_id", …)` で自社に絞っている）。
--    漏れていたのは **PostgREST を直接叩く経路だけ**
--    ——CLAUDE.md「画面が動いているは検証にならない」の実例。
--
-- ── なぜ `security_invoker` にしないのか ────────────────────────────────────
-- 検討したが**不十分**。invoker にすると下層 `ow_jobs` の RLS が効くが、
-- **公開求人は誰でも読める**ので、`view_count` / `application_count` /
-- `conversion_rate_pct` が全社ぶん anon に出たままになる（実測: anon の ow_jobs = 5行）。
-- これらは**企業の営業数値**であって公開情報ではない。→ 権限ごと剥がす。
--
-- ── 読み手はすべて service_role に切り替え済み（同じコミット）────────────────
--   lib/business/dashboard.ts  getTodoCounts / getMonthlyStats /
--                              getJobStatusCounts / getJobPerformance
--   app/biz/analytics/page.tsx fetchSixMonthStats
-- いずれも `getTenantContext()` が所属を検証した `tenantId` で絞っている。
-- ⚠️ **`createClient()`（セッション）に戻さないこと。** 401 になり、
--    `?? 0` / `?? []` で受けているので**画面が全部 0 になって気づけない。**
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/（下記コマンドで取得済み）
--   戻すなら `GRANT SELECT ON <view> TO anon, authenticated;`
--   ⚠️ ただし**戻すと同じ漏れが再発する。** 戻す前にこのコメントを読むこと。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v int;
BEGIN
  -- ★適用前: anon が3ビューとも読める状態であること（前提の確認）
  SELECT count(*) INTO v FROM (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema='public' AND grantee='anon' AND privilege_type='SELECT'
       AND table_name IN ('ow_business_job_performance','ow_business_todo_counts','ow_business_monthly_stats')
  ) t;
  IF v <> 3 THEN
    RAISE EXCEPTION 'anon の SELECT が % 件（3 のはず）。前提が違う。中止', v;
  END IF;
  RAISE NOTICE '適用前: anon SELECT % 件', v;
END $$;

/* ⚠️ 対象は3つだけ。他のビューを巻き込まないよう名前で明示列挙する。
      `GRANT ALL` が付いていたので INSERT/UPDATE/DELETE/TRUNCATE 等もまとめて落とす。 */
REVOKE ALL ON TABLE public.ow_business_job_performance FROM anon, authenticated;
REVOKE ALL ON TABLE public.ow_business_todo_counts     FROM anon, authenticated;
REVOKE ALL ON TABLE public.ow_business_monthly_stats   FROM anon, authenticated;

/* ⚠️ service_role は残す（アプリの読み手はこちらに切り替え済み）。
      baseline で既に付いているが、**明示して意図を残す**。 */
GRANT SELECT ON TABLE public.ow_business_job_performance TO service_role;
GRANT SELECT ON TABLE public.ow_business_todo_counts     TO service_role;
GRANT SELECT ON TABLE public.ow_business_monthly_stats   TO service_role;

COMMENT ON VIEW public.ow_business_job_performance IS
  '求人ごとの閲覧数・応募数。⚠️ service_role 限定（2026-08-29）。anon/authenticated に開けると、'
  '非公開求人のタイトルと各社の営業数値が誰にでも読める（RLS を迂回するビューのため）。';
COMMENT ON VIEW public.ow_business_todo_counts IS
  '企業ごとの要対応件数。⚠️ service_role 限定（2026-08-29）。理由は ow_business_job_performance と同じ。';
COMMENT ON VIEW public.ow_business_monthly_stats IS
  '企業ごとの月次実績。⚠️ service_role 限定（2026-08-29）。理由は ow_business_job_performance と同じ。';

DO $$
DECLARE v_open int; v_svc int;
BEGIN
  SELECT count(*) INTO v_open FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee IN ('anon','authenticated')
     AND table_name IN ('ow_business_job_performance','ow_business_todo_counts','ow_business_monthly_stats');
  IF v_open <> 0 THEN
    RAISE EXCEPTION 'anon/authenticated の権限が % 件残っている。中止', v_open;
  END IF;

  SELECT count(*) INTO v_svc FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='service_role' AND privilege_type='SELECT'
     AND table_name IN ('ow_business_job_performance','ow_business_todo_counts','ow_business_monthly_stats');
  IF v_svc <> 3 THEN
    RAISE EXCEPTION 'service_role の SELECT が % 件（3 のはず）。中止', v_svc;
  END IF;

  RAISE NOTICE '完了: anon/authenticated %件 / service_role SELECT %件', v_open, v_svc;
END $$;

COMMIT;
