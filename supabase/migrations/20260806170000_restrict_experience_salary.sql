-- ═══════════════════════════════════════════════════════════════════════════
-- 職歴の年収（ow_experiences.salary_*）を authenticated から読めなくする
--
-- ── なぜ（2026-08-06）──────────────────────────────────────────────────────
-- `visibility_salary`（年収を公開するか）を honor しているのは
-- get_public_career_steps() **だけ**で、その関数はアプリから呼ばれていない。
-- 実際に効いている経路であるテーブル直読みは、
--   ・GRANT ALL ON TABLE ow_experiences TO authenticated（列制限なし）
--   ・RLS の3ポリシーはどれも visibility_salary を見ない
-- のため、**ログイン済みの誰でも他人の年収を読めた**。
-- visibility_salary = false の行の額まで返っていた。設定と実態が逆。
-- 2026-08-06 に一般ユーザーのトークンで実測: 3件すべての額が返った。
--
-- ⚠️ 額そのものは消さない（列とデータは残す）。読めなくするだけ。
-- ⚠️ anon は既に列単位 GRANT で salary_man を外してあり、この migration では触らない。
--
-- ── 列の選び方 ──────────────────────────────────────────────────────────────
-- 指示は「anon と同じ19列」だったが、**それだと壊れる**。
-- アプリが認証済みクライアントで読んでいる列のうち
--   department / rank / visibility_company_profile
-- の3列が anon の19列に入っていない（/mypage と GET /api/jobseeker/experiences）。
-- そこで「**年収4列を除く全26列**」にする。目的（額を読ませない）は同じで、
-- 他の列の挙動は変わらない。
--
-- 除外する4列: salary_man / salary_base / salary_bonus / salary_stock
--
-- ⚠️ SELECT だけ列単位にする。INSERT / UPDATE / DELETE は表レベルのまま残す。
--    本人が自分の職歴を編集する経路（RLS: ow_experiences_own_manage）を壊さないため。
--    自分の行の年収を更新できてしまうが、それは本人のデータなので問題にしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_table_select int; v_col_select int; v_salary int;
BEGIN
  -- authenticated が表レベルの SELECT を持っていること（＝まだ絞られていない）
  SELECT count(*) INTO v_table_select
    FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ow_experiences'
     AND grantee='authenticated' AND privilege_type='SELECT';
  IF v_table_select = 0 THEN
    RAISE EXCEPTION 'authenticated に表レベル SELECT が無い。既に適用済み？中止';
  END IF;

  SELECT count(*) INTO v_col_select
    FROM information_schema.column_privileges
   WHERE table_schema='public' AND table_name='ow_experiences'
     AND grantee='authenticated' AND privilege_type='SELECT';
  RAISE NOTICE '適用前: authenticated の列単位 SELECT % 列（表レベル SELECT あり）', v_col_select;

  SELECT count(*) INTO v_salary FROM public.ow_experiences WHERE salary_man IS NOT NULL;
  RAISE NOTICE '適用前: salary_man に値がある行 % 件', v_salary;
END $$;

-- ── ① authenticated の SELECT を列単位に絞る ───────────────────────────────
REVOKE SELECT ON TABLE public.ow_experiences FROM authenticated;

GRANT SELECT (
  id, user_id, company_id, company_text, company_anonymized,
  role_category_id, role_title, started_at, ended_at, is_current,
  description, display_order, created_at, updated_at,
  join_reason, employment_type,
  visibility_company, visibility_salary, visibility_reason,
  turning_point, exit_reason, rank, visibility_company_profile,
  department, learnings, department_id
) ON TABLE public.ow_experiences TO authenticated;

-- ── ② visibility_salary を false に揃える ──────────────────────────────────
-- ⚠️ 対象は「salary_man に値がある3件」だけ。実測で3件であることを確認済み。
--    true は2件だが、false の1件も含めて明示的に false にしておく
--    （実態と設定を一致させるのが目的なので、対象行を絞る条件は salary_man の有無にする）。
-- ⚠️ true=2件 は本人が選んだ値ではない。3件とも created_at が
--    2026-06-03T12:20:02.413456 で完全に同一の migration 投入で、
--    本人は auth_id が null のためログインできず、自分で下げる手段が無い。
UPDATE public.ow_experiences
   SET visibility_salary = false
 WHERE salary_man IS NOT NULL
   AND visibility_salary = true;

-- ── ③ get_public_career_steps() から salary_man を落とす ───────────────────
-- ⚠️ 戻り値の型が変わるので DROP してから作り直す（CREATE OR REPLACE では変えられない）。
--    呼び出し元は 2026-08-06 時点で 0 件（grep で確認済み）。
DROP FUNCTION IF EXISTS public.get_public_career_steps(uuid);

CREATE FUNCTION public.get_public_career_steps(p_user_id uuid)
RETURNS TABLE(
  id uuid, user_id uuid, company_id uuid, company_text text, company_anonymized text,
  role_category_id uuid, role_title text, started_at date, ended_at date, is_current boolean,
  description text, display_order integer, join_reason text, employment_type text,
  visibility_company text, visibility_reason boolean,
  created_at timestamp with time zone, updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_is_owner BOOLEAN := false;
  v_caller_is_admin BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM ow_users u WHERE u.id = p_user_id AND u.auth_id = auth.uid()
  ) INTO v_caller_is_owner;

  SELECT EXISTS (
    SELECT 1 FROM ow_user_roles r
    JOIN ow_users u ON u.id = r.user_id
    WHERE u.auth_id = auth.uid() AND r.role = 'admin'
  ) INTO v_caller_is_admin;

  IF v_caller_is_owner OR v_caller_is_admin THEN
    -- 本人 / admin: hidden 行も含めて返す。is_published のチェックなし
    RETURN QUERY
      SELECT
        e.id, e.user_id, e.company_id, e.company_text, e.company_anonymized,
        e.role_category_id, e.role_title, e.started_at, e.ended_at, e.is_current,
        e.description, e.display_order, e.join_reason, e.employment_type,
        e.visibility_company, e.visibility_reason,
        e.created_at, e.updated_at
      FROM ow_experiences e
      WHERE e.user_id = p_user_id
      ORDER BY e.display_order;
  ELSE
    -- 公開ユーザー向け:
    --   [ガード 1] ow_career_profiles.is_published = true
    --   [ガード 2] ow_users.visibility が公開可
    --   [ガード 3] visibility_company='hidden' 行を除外
    --   [マスク]   company は visibility_company に従う / join_reason は visibility_reason に従う
    -- ⚠️ salary_man は 2026-08-06 に戻り値ごと削除した。
    --    visibility_salary を honor していたのはこの関数だけだったが、
    --    実際に使われている経路（テーブル直読み）は見ていなかったため、
    --    「ここで守れている」という誤解を生んでいた。年収は返さないことで揃える。
    RETURN QUERY
      SELECT
        e.id,
        e.user_id,
        CASE WHEN e.visibility_company = 'real' THEN e.company_id    ELSE NULL::UUID END,
        CASE WHEN e.visibility_company = 'real' THEN e.company_text  ELSE NULL::TEXT END,
        e.company_anonymized,
        e.role_category_id,
        e.role_title,
        e.started_at,
        e.ended_at,
        e.is_current,
        e.description,
        e.display_order,
        CASE WHEN e.visibility_reason THEN e.join_reason ELSE NULL::TEXT END,
        e.employment_type,
        e.visibility_company,
        e.visibility_reason,
        e.created_at,
        e.updated_at
      FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
      WHERE e.user_id = p_user_id
        AND EXISTS (
          SELECT 1 FROM ow_career_profiles cp
          WHERE cp.user_id = p_user_id AND cp.is_published = true
        )
        AND (
          u.visibility = 'public'
          OR (auth.uid() IS NOT NULL AND u.visibility = 'login_only')
        )
        AND e.visibility_company <> 'hidden'
      ORDER BY e.display_order;
  END IF;
END;
$$;

ALTER FUNCTION public.get_public_career_steps(uuid) OWNER TO postgres;
GRANT ALL ON FUNCTION public.get_public_career_steps(uuid) TO anon;
GRANT ALL ON FUNCTION public.get_public_career_steps(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_public_career_steps(uuid) TO service_role;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_table_select int; v_cols int; v_salary_col int; v_vis int; v_rows int;
BEGIN
  -- 表レベル SELECT が消えていること
  SELECT count(*) INTO v_table_select
    FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ow_experiences'
     AND grantee='authenticated' AND privilege_type='SELECT';
  IF v_table_select <> 0 THEN RAISE EXCEPTION '表レベル SELECT が残っている。ロールバック'; END IF;

  -- 年収4列に SELECT が無いこと
  SELECT count(*) INTO v_salary_col
    FROM information_schema.column_privileges
   WHERE table_schema='public' AND table_name='ow_experiences'
     AND grantee='authenticated' AND privilege_type='SELECT'
     AND column_name IN ('salary_man','salary_base','salary_bonus','salary_stock');
  IF v_salary_col <> 0 THEN RAISE EXCEPTION '年収列に SELECT が % 列残っている。ロールバック', v_salary_col; END IF;

  -- 残り26列には SELECT があること
  SELECT count(*) INTO v_cols
    FROM information_schema.column_privileges
   WHERE table_schema='public' AND table_name='ow_experiences'
     AND grantee='authenticated' AND privilege_type='SELECT';
  IF v_cols <> 26 THEN RAISE EXCEPTION '列単位 SELECT が % 列（想定26）。ロールバック', v_cols; END IF;

  -- INSERT / UPDATE / DELETE は表レベルで残っていること（本人の編集経路）
  IF (SELECT count(*) FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name='ow_experiences' AND grantee='authenticated'
         AND privilege_type IN ('INSERT','UPDATE','DELETE')) <> 3 THEN
    RAISE EXCEPTION 'INSERT/UPDATE/DELETE が欠けている。ロールバック';
  END IF;

  -- visibility_salary が true の行が無いこと
  SELECT count(*) INTO v_vis FROM public.ow_experiences WHERE visibility_salary = true;
  IF v_vis <> 0 THEN RAISE EXCEPTION 'visibility_salary=true が % 件残っている。ロールバック', v_vis; END IF;

  -- 額は消していないこと
  SELECT count(*) INTO v_rows FROM public.ow_experiences WHERE salary_man IS NOT NULL;
  IF v_rows <> 3 THEN RAISE EXCEPTION 'salary_man に値がある行が % 件（想定3）。ロールバック', v_rows; END IF;

  -- 関数の戻り値に salary_man が無いこと
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='get_public_career_steps'
              AND pg_get_function_result(oid) LIKE '%salary_man%') THEN
    RAISE EXCEPTION 'get_public_career_steps がまだ salary_man を返す。ロールバック';
  END IF;

  RAISE NOTICE '完了: authenticated の SELECT を % 列に限定（年収4列を除外）/ visibility_salary=true 0件 / 額は % 件そのまま', v_cols, v_rows;
END $$;

COMMIT;
