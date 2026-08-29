-- ═══════════════════════════════════════════════════════════════════════════
-- `ow_follows_v` を service_role 限定にする（2026-08-29 / `20260829110000` の続き）
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- baseline が `GRANT ALL ... TO anon` を付けており、**ビューは RLS を迂回する**
-- （`OWNER TO postgres` / `security_invoker` ではない）。
--
-- ⚠️★**いま漏れていない理由は「中身が0件だから」でしかない。**
--    実測（2026-08-29）: anon 200/**0行** ／ service_role 200/**0行**。
--    下層の `ow_user_follows` 0件・`ow_company_follows` 0件。
--    **誰かが最初のフォローをした瞬間に、誰がどこをフォローしているかが
--      未ログインから読めるようになる。**
--    CLAUDE.md「起きなかった0か、起こせなかった0かを分ける」——これは前者で、
--    **0 件であることを遮断の証明に使えない**（ビューなので RLS すら効かない）。
--
-- ── 読み手は1つだけで、すでに service_role ────────────────────────────────
--   `app/(jobseeker)/mypage/follows/page.tsx` が `createAdminClient()` で引き、
--   `.eq("follower_user_id", me.id)` で**本人のぶんだけ**に絞っている。
--   ⚠️ **`createClient()`（セッション）に変えないこと。** 403 になり、
--      `?? []` で受けているので**フォロー一覧が空になるだけ**で気づけない。
--
-- ── 全ビューを実測した結果、残っていたのはこれだけ ──────────────────────────
--   ビュー25本を anon で総当たりし、読めたのは `ow_follows_v` のみ。
--   `ow_posts_visible` は既に 401、`ow_business_*` 3本は `20260829110000` で遮断済み。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/（ow_user_follows / ow_company_follows）
--   ⚠️ 戻すと同じ漏れが再発する。戻す前にこのコメントを読むこと。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ow_follows_v' AND grantee IN ('anon','authenticated');
  IF v = 0 THEN RAISE EXCEPTION 'anon/authenticated の権限が既に無い。適用済みか前提が違う。中止'; END IF;
  RAISE NOTICE '適用前: anon/authenticated の権限 % 件', v;
END $$;

REVOKE ALL ON TABLE public.ow_follows_v FROM anon, authenticated;
GRANT SELECT ON TABLE public.ow_follows_v TO service_role;

COMMENT ON VIEW public.ow_follows_v IS
  'フォロー関係（ow_company_follows と ow_user_follows の UNION）。'
  '⚠️ service_role 限定（2026-08-29）。ビューは RLS を迂回するので、開けると'
  '「誰がどこをフォローしているか」が全件読めてしまう。読み手は /mypage/follows のみ。';

DO $$
DECLARE v_open int; v_svc int;
BEGIN
  SELECT count(*) INTO v_open FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ow_follows_v' AND grantee IN ('anon','authenticated');
  IF v_open <> 0 THEN RAISE EXCEPTION 'anon/authenticated の権限が % 件残っている。中止', v_open; END IF;

  SELECT count(*) INTO v_svc FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ow_follows_v' AND grantee='service_role' AND privilege_type='SELECT';
  IF v_svc <> 1 THEN RAISE EXCEPTION 'service_role の SELECT が % 件（1 のはず）。中止', v_svc; END IF;

  RAISE NOTICE '完了: anon/authenticated %件 / service_role SELECT %件', v_open, v_svc;
END $$;

COMMIT;
