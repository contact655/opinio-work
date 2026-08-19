-- ═══════════════════════════════════════════════════════════════════════════
-- 死んだ3関数を落とす（2026-08-20）
--   has_worked_at_company(uuid, uuid)
--   guard_salary_insert()
--   guard_review_insert()
--
-- ── 経緯 ─────────────────────────────────────────────────────────────────
--   `user_id` の空間取り違えを洗ったときに `has_worked_at_company` が挙がった。
--   **アプリからの呼び出しは0件**（src の grep で0）だが、
--   ⚠️ **DB の中には呼び出し元が2つあった**（`guard_salary_insert` / `guard_review_insert`）。
--      CLAUDE.md「FK を見ただけでは足りない。PL/pgSQL の本体は Postgres が
--      依存として追跡しない」がそのまま出た形。**関数の本文まで検索して見つけた。**
--
--   さらに追うと、その2つの guard は **どのトリガーにも紐づいていない**（実測 0件）。
--   対象だった表が両方とも既に無いため:
--     `ow_salary_reports`   … 20260806160000 で DROP 済み（実測: 存在しない）
--     `ow_company_reviews`  … 存在しない（残っているのは
--                              `ow_company_reviews_archive_20260714` というアーカイブ表のみ）
--
--   **つまり3本まとめて死んでいる。** 消す。
--
-- ── なぜ「残す」ではなく「消す」か ───────────────────────────────────────
--   `has_worked_at_company(p_user_id, ...)` は内部で `ow_experiences.user_id`
--   （**ow_users 空間**）と突き合わせる。**auth 空間の id を渡すと静かに false を返す。**
--   使われていない関数を残すと、次に使う人が空間を取り違えても気づけない
--   （`can_send_scout` で実際に起きたのがこれ）。
--   **使うときに正しい名前で作り直すほうが安全。**
--   新しく作るときの規約は CLAUDE.md「関数の引数はどちらの空間かを名前で示す」。
--
-- ⚠️ アーカイブ表 `ow_company_reviews_archive_20260714` は**触らない**。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_trg int; v_tbl int; v_pol int; v_view int;
BEGIN
  -- ① この3関数に紐づく trigger が本当に0本か
  SELECT count(*) INTO v_trg FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
   WHERE NOT t.tgisinternal
     AND p.pronamespace='public'::regnamespace
     AND p.proname IN ('guard_salary_insert','guard_review_insert','has_worked_at_company');
  IF v_trg <> 0 THEN RAISE EXCEPTION 'trigger が % 本ある（想定0）。中止', v_trg; END IF;

  -- ② 対象だった表が本当に無いか
  SELECT count(*) INTO v_tbl FROM pg_class
   WHERE relnamespace='public'::regnamespace AND relkind='r'
     AND relname IN ('ow_salary_reports','ow_company_reviews');
  IF v_tbl <> 0 THEN RAISE EXCEPTION '対象表が % 件残っている（想定0）。中止', v_tbl; END IF;

  -- ③ ポリシー・ビューから参照されていないか（FK では追えないので本文を検索する）
  SELECT count(*) INTO v_pol FROM pg_policy p
   WHERE coalesce(pg_get_expr(p.polqual,p.polrelid),'') ~ '\mhas_worked_at_company\M'
      OR coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') ~ '\mhas_worked_at_company\M';
  IF v_pol <> 0 THEN RAISE EXCEPTION 'ポリシーから % 件参照されている。中止', v_pol; END IF;

  SELECT count(*) INTO v_view FROM pg_views WHERE definition ~ '\mhas_worked_at_company\M';
  IF v_view <> 0 THEN RAISE EXCEPTION 'ビューから % 件参照されている。中止', v_view; END IF;

  RAISE NOTICE '適用前: trigger 0 / 対象表 0 / ポリシー 0 / ビュー 0';
END $$;

DROP FUNCTION IF EXISTS public.guard_salary_insert();
DROP FUNCTION IF EXISTS public.guard_review_insert();
DROP FUNCTION IF EXISTS public.has_worked_at_company(uuid, uuid);

DO $$
DECLARE v_left int;
BEGIN
  SELECT count(*) INTO v_left FROM pg_proc
   WHERE pronamespace='public'::regnamespace
     AND proname IN ('guard_salary_insert','guard_review_insert','has_worked_at_company');
  IF v_left <> 0 THEN RAISE EXCEPTION '% 本残っている。中止', v_left; END IF;

  -- 他の関数が参照していないこと（残骸が呼び出しっぱなしになっていないか）
  SELECT count(*) INTO v_left FROM pg_proc
   WHERE pronamespace='public'::regnamespace
     AND pg_get_functiondef(oid) ~ '\m(has_worked_at_company|guard_salary_insert|guard_review_insert)\M';
  IF v_left <> 0 THEN RAISE EXCEPTION '削除した関数を参照する関数が % 本残っている。中止', v_left; END IF;

  RAISE NOTICE '適用後: 3関数を削除。参照している関数も0本';
END $$;

COMMIT;
