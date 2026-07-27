-- Migration 178: get_public_career_steps() の salary_man 返却を修正
--
-- 問題: 非オーナー/非admin 分岐で salary_man が常に NULL::INT になっており、
--       visibility_salary=true を設定しても公開ユーザーに年収が表示されない。
-- 修正: CASE WHEN e.visibility_salary THEN e.salary_man ELSE NULL::INT END
--       に変更し、本人が公開OKした分だけ実数を返す。
--
-- セキュリティ保証:
--   - salary_man の直読みは column-level REVOKE (Migration 177) で守られている
--   - この関数は SECURITY DEFINER なので salary_man を読めるが、
--     visibility_salary=false の場合は NULL を返す
--   - オーナー/admin は引き続き全カラム・全行を取得可能

CREATE OR REPLACE FUNCTION public.get_public_career_steps(p_user_id uuid)
RETURNS TABLE(
  id                 uuid,
  user_id            uuid,
  company_id         uuid,
  company_text       text,
  company_anonymized text,
  role_category_id   uuid,
  role_title         text,
  started_at         date,
  ended_at           date,
  is_current         boolean,
  description        text,
  display_order      integer,
  join_reason        text,
  employment_type    text,
  salary_man         integer,
  visibility_company text,
  visibility_salary  boolean,
  visibility_reason  boolean,
  created_at         timestamptz,
  updated_at         timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller_is_owner BOOLEAN := false;
  v_caller_is_admin BOOLEAN := false;
BEGIN
  -- 本人判定
  SELECT EXISTS (
    SELECT 1 FROM ow_users u
    WHERE u.id = p_user_id AND u.auth_id = auth.uid()
  ) INTO v_caller_is_owner;

  -- admin 判定
  SELECT EXISTS (
    SELECT 1 FROM ow_user_roles r
    JOIN ow_users u ON u.id = r.user_id
    WHERE u.auth_id = auth.uid() AND r.role = 'admin'
  ) INTO v_caller_is_admin;

  IF v_caller_is_owner OR v_caller_is_admin THEN
    -- 本人 / admin: 全カラムを返す（hidden 行含む）
    -- is_published チェックなし（下書き状態でも編集・確認できる）
    RETURN QUERY
      SELECT
        e.id, e.user_id, e.company_id, e.company_text, e.company_anonymized,
        e.role_category_id, e.role_title, e.started_at, e.ended_at, e.is_current,
        e.description, e.display_order, e.join_reason, e.employment_type,
        e.salary_man,
        e.visibility_company, e.visibility_salary, e.visibility_reason,
        e.created_at, e.updated_at
      FROM ow_experiences e
      WHERE e.user_id = p_user_id
      ORDER BY e.display_order;

  ELSE
    -- 公開ユーザー向け:
    --   [ガード 1] ow_career_profiles.is_published = true が存在すること
    --   [ガード 2] ow_users.visibility が公開可
    --   [ガード 3] visibility_company='hidden' 行を除外
    --   [マスク]   company は visibility_company に従い実名/匿名/NULL
    --              salary_man は visibility_salary=true の時のみ実数、false は NULL
    --              join_reason は visibility_reason=true の時のみ実テキスト、false は NULL
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
        CASE WHEN e.visibility_reason   THEN e.join_reason ELSE NULL::TEXT END,
        e.employment_type,
        CASE WHEN e.visibility_salary   THEN e.salary_man  ELSE NULL::INT  END,  -- 修正
        e.visibility_company,
        e.visibility_salary,
        e.visibility_reason,
        e.created_at,
        e.updated_at
      FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
      WHERE e.user_id = p_user_id
        -- ガード 1: is_published=true のプロフィールが存在すること
        AND EXISTS (
          SELECT 1 FROM ow_career_profiles cp
          WHERE cp.user_id = p_user_id
            AND cp.is_published = true
        )
        -- ガード 2: ow_users.visibility
        AND (
          u.visibility = 'public'
          OR (auth.uid() IS NOT NULL AND u.visibility = 'login_only')
        )
        -- ガード 3: hidden ステップを除外
        AND e.visibility_company <> 'hidden'
      ORDER BY e.display_order;
  END IF;
END;
$$;
