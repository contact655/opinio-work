-- ============================================================================
-- ow_companies：企業管理者が自社を編集できるようにし、承認は運営だけに限る
--
-- 2026-08-23。0行更新の横断調査で見つかった。**2つの問題を同時に直す。**
--
-- ── 問題1：企業情報の保存が87社中85社で動いていない ────────────────────
-- `ow_companies` の UPDATE ポリシーは `ow_companies_own_update` の1本だけで、
-- 条件は `auth.uid() = user_id`。**`user_id` は87社中2社にしか入っておらず、
-- しかもその2社とも is_test アカウントを指している**（片方は管理者ですらない）。
--
-- `PATCH /api/biz/company` は**利用者セッション**で更新し、`.select()` が無いため
-- 0行更新が `error = null` で返る。**画面は保存されたように見えていた。**
-- 実測（現在値を書き戻す非破壊の確認）:
--   Salesforce の管理者 → tagline  更新行数=0
--   Opinio の管理者     → tagline  更新行数=0
--
-- ⚠️ 2026-08-11 の企業ロゴURL（83社で0行更新）と**同じ根**。
--
-- ── 問題2：承認を企業が自分で立てられる ────────────────────────────────
-- 同じポリシーが `is_approved` / `is_published` / `listing_status` を見ておらず、
-- 列単位 UPDATE GRANT もこの3列に配られている。
-- `user_id` を持つ企業の担当者は、自社を承認済み・一覧掲載にできた。
--
-- ── アプリが定めている規則（これに DB を揃える）──────────────────────
-- `PATCH /api/biz/company` の実装より:
--   ・`is_approved` … **アプリは書かない**（運営専用）
--   ・`is_published` / `listing_status` … 企業が切り替えてよい。
--     ただし `if (body.isPublished && !currentRow?.is_approved) → 403`
--     ＝ **運営の承認が済んでいる企業だけ**
--
-- ── 直し方 ──────────────────────────────────────────────────────────────
--   ① `ow_companies_own_update`（`user_id` 依存）を削除
--   ② `auth_is_company_admin(id)` の UPDATE ポリシーを新設
--   ③ 承認3列の遷移を BEFORE UPDATE トリガーで守る
--   ④ 列単位 UPDATE GRANT から `is_approved` を外す
--
-- ⚠️ **`is_published` / `listing_status` の GRANT は残す。**
--    企業が「公開する／取り下げる」を切り替える正規の機能で、
--    条件（承認済みか）はトリガーが見る。
--
-- ⚠️ **`WITH CHECK` ではなくトリガーにする理由。** `WITH CHECK` は
--    「変更後の行」しか見えない。`ow_jobs` で同じ書き方をして
--    **公開中の求人のタイトルすら直せなくなった**（20260823090000 → 100000 で修正）。
--    「値」ではなく「遷移」を守るので、OLD と NEW を比べられるトリガーが要る。
--
-- ⚠️ **`user_id` 列そのものは落とさない**（死列の掃除は別タスク）。
--
-- ── 復元用 ──────────────────────────────────────────────────────────────
-- DROP POLICY ow_companies_company_admin_update ON public.ow_companies;
-- DROP TRIGGER trg_guard_company_approval ON public.ow_companies;
-- DROP FUNCTION public.guard_company_approval();
-- CREATE POLICY ow_companies_own_update ON public.ow_companies
--   FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- GRANT UPDATE (is_approved) ON TABLE public.ow_companies TO authenticated;
-- 作業前ダンプ: .dumps/20260823-1011-ow_companies.sql（181,719バイト / 87行）
-- ============================================================================

-- ── ① 適用前の検算 ──────────────────────────────────────────────────────
DO $$
DECLARE v_rows int; v_uid int; v_pol int;
BEGIN
  SELECT count(*), count(user_id) INTO v_rows, v_uid FROM public.ow_companies;
  IF v_rows <> 87 OR v_uid <> 2 THEN
    RAISE EXCEPTION '前提が変わっている（%社 / user_id あり %社）', v_rows, v_uid;
  END IF;

  SELECT count(*) INTO v_pol FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_companies' AND p.polcmd='w';
  IF v_pol <> 1 THEN
    RAISE EXCEPTION 'UPDATE ポリシーが1本ではない（%本）', v_pol;
  END IF;

  RAISE NOTICE '適用前: 87社 / user_id あり 2社 / UPDATE ポリシー 1本';
END $$;

-- ── ② user_id 依存のポリシーを、企業管理者の条件に置き換える ──────────
DROP POLICY ow_companies_own_update ON public.ow_companies;

CREATE POLICY ow_companies_company_admin_update ON public.ow_companies
  FOR UPDATE
  USING (public.auth_is_company_admin(id))
  /* ⚠️ WITH CHECK に承認列の条件を書かない。「遷移」はトリガーが見る。 */
  WITH CHECK (public.auth_is_company_admin(id));

-- ── ③ 承認の遷移をトリガーで守る ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_company_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER          -- ⚠️ 呼び出し元のロールを見たいので INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  /* 運営の経路はそのまま通す。
     ⚠️ `/admin/companies` は admin クライアント（service_role）で更新する。
        RLS は迂回するが**トリガーは迂回しない**ので、ここで除外する。 */
  IF current_user = 'service_role' OR public.auth_is_admin() THEN
    RETURN NEW;
  END IF;

  -- ⚠️ 承認は運営だけ。企業は自分で立てられない
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    RAISE EXCEPTION '企業の承認は運営が行います'
      USING ERRCODE = '42501';
  END IF;

  /* 公開・一覧掲載は企業が切り替えてよい。**ただし承認済みの企業だけ。**
     アプリ側（PATCH /api/biz/company の「未承認の企業は公開不可」）と同じ規則。
     ⚠️ `is_approved` は上で変更を禁じているので、ここで見る OLD の値が正。 */
  IF (NEW.is_published IS DISTINCT FROM OLD.is_published AND NEW.is_published = true)
     OR (NEW.listing_status IS DISTINCT FROM OLD.listing_status AND NEW.listing_status = 'listed')
  THEN
    IF NOT COALESCE(OLD.is_approved, false) THEN
      RAISE EXCEPTION '運営の承認が完了するまで公開できません'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_company_approval ON public.ow_companies;
CREATE TRIGGER trg_guard_company_approval
  BEFORE UPDATE ON public.ow_companies
  FOR EACH ROW EXECUTE FUNCTION public.guard_company_approval();

-- ── ④ is_approved の列単位 UPDATE GRANT を外す ─────────────────────────
-- ⚠️ `ow_companies` は**テーブルレベルの UPDATE を落として列単位で配り直している**
--    （CLAUDE.md / docs/ow-companies-grants.md）。この1列だけを抜く。
REVOKE UPDATE (is_approved) ON TABLE public.ow_companies FROM authenticated;

-- ── ⑤ 適用後の検算 ──────────────────────────────────────────────────────
DO $$
DECLARE v int;
BEGIN
  IF has_column_privilege('authenticated','public.ow_companies','is_approved','UPDATE') THEN
    RAISE EXCEPTION 'is_approved の UPDATE 権限が残っている';
  END IF;
  -- 企業が切り替える2列は残っていること
  IF NOT has_column_privilege('authenticated','public.ow_companies','is_published','UPDATE')
     OR NOT has_column_privilege('authenticated','public.ow_companies','listing_status','UPDATE') THEN
    RAISE EXCEPTION 'is_published / listing_status の UPDATE 権限まで剥がれている';
  END IF;
  -- 通常の編集に使う列が残っていること（抜き取り）
  IF NOT has_column_privilege('authenticated','public.ow_companies','tagline','UPDATE')
     OR NOT has_column_privilege('authenticated','public.ow_companies','description','UPDATE') THEN
    RAISE EXCEPTION '通常の編集に使う列の UPDATE 権限が剥がれている';
  END IF;

  SELECT count(*) INTO v FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   WHERE c.relname='ow_companies' AND t.tgname='trg_guard_company_approval' AND NOT t.tgisinternal;
  IF v <> 1 THEN RAISE EXCEPTION 'トリガーが張られていない'; END IF;

  SELECT count(*) INTO v FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   WHERE c.relname='ow_companies' AND p.polcmd='w'
     AND pg_get_expr(p.polqual,p.polrelid) ~ 'auth_is_company_admin';
  IF v <> 1 THEN RAISE EXCEPTION '企業管理者の UPDATE ポリシーが無い'; END IF;

  SELECT count(*) INTO v FROM public.ow_companies;
  IF v <> 87 THEN RAISE EXCEPTION 'データが変わっている（%社）', v; END IF;

  RAISE NOTICE '企業管理者の UPDATE ポリシー1本 / トリガー1本 / is_approved の権限なし / 87社';
END $$;
