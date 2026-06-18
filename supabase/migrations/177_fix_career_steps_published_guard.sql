-- ================================================================
-- Migration 177: キャリア軌跡 — is_published ガード追加 + anon 列保護修正
-- ================================================================
--
-- 修正 1: get_public_career_steps() に is_published=true ガードを追加
--   非オーナー/非admin は ow_career_profiles.is_published=true の
--   プロフィールが存在しないと 0 行を返す（Migration 176 では欠如していた）
--
-- 修正 2: anon の salary_man 列保護
--   REVOKE SELECT (col) FROM anon は Supabase デフォルトの
--   テーブルレベル arwdDxtm を上書きできないため、
--   テーブルレベル SELECT を一旦剥がして列単位で再 GRANT する。
--   除外: salary_man のみ（company_text は既存 /u/[id] で使用するため残す）
--
-- 注意: authenticated ロールの salary_man は Phase 2 で対処。
--   理由: company_text 等の既存カラムが profile/edit 等で使用中のため
--   テーブルレベル REVOKE は影響範囲が大きい。
--   salary_man は現在全行 NULL かつ Phase 2 admin UI は service_role を使う方針。
-- ================================================================

-- ----------------------------------------------------------------
-- 修正 1: get_public_career_steps() に is_published ガードを追加
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_public_career_steps(p_user_id UUID)
RETURNS TABLE (
  id                  UUID,
  user_id             UUID,
  company_id          UUID,
  company_text        TEXT,
  company_anonymized  TEXT,
  role_category_id    UUID,
  role_title          TEXT,
  started_at          DATE,
  ended_at            DATE,
  is_current          BOOLEAN,
  description         TEXT,
  display_order       INT,
  join_reason         TEXT,
  employment_type     TEXT,
  salary_man          INT,
  visibility_company  TEXT,
  visibility_salary   BOOLEAN,
  visibility_reason   BOOLEAN,
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
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
    -- それ以外:
    --   [ガード 1] ow_career_profiles.is_published = true が存在しなければ 0 行
    --   [ガード 2] ow_users.visibility が公開可（public / login_only+認証）
    --   [ガード 3] visibility_company='hidden' 行を除外
    --   [マスク]   salary_man=NULL, company_text=masked 時は NULL
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
        NULL::INT,   -- salary_man: 本人/admin 以外には常に NULL
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
        -- ガード 2: ow_users.visibility（公開制御の主従 — 厳しい方優先）
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

GRANT EXECUTE ON FUNCTION get_public_career_steps(UUID) TO authenticated, anon;

-- ----------------------------------------------------------------
-- 修正 2: anon の salary_man 列保護
-- テーブルレベル SELECT を一旦剥がして列単位で再 GRANT（salary_man を除外）
-- ----------------------------------------------------------------

-- Step 1: anon のテーブルレベル SELECT を剥がす
REVOKE SELECT ON ow_experiences FROM anon;

-- Step 2: salary_man を除いた全カラムを anon に再 GRANT
-- （company_text は /u/[id] 等の既存ページで使用するため残す）
GRANT SELECT (
  id,
  user_id,
  company_id,
  company_text,
  company_anonymized,
  role_category_id,
  role_title,
  started_at,
  ended_at,
  is_current,
  description,
  display_order,
  join_reason,
  employment_type,
  visibility_company,
  visibility_salary,
  visibility_reason,
  created_at,
  updated_at
) ON ow_experiences TO anon;
-- salary_man は除外 — anon キー直叩きで取得不可
