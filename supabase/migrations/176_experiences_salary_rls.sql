-- ================================================================
-- Migration 176: ow_experiences — salary_man / company_text DB 層保護
-- ================================================================
-- Phase 1 補完: Migration 175 では ow_experiences の既存 RLS を変更しなかった。
-- 本 migration で以下を行う:
--
-- (A) 既存 public/login SELECT ポリシーを更新
--     → visibility_company='hidden' のステップを行レベルで除外
--
-- (B) anon ロールの salary_man / company_text カラム権限を剥奪
--     → curl 等での直叩き（Bearer なし）で salary_man が返らない
--
-- (C) SECURITY DEFINER 関数 get_public_career_steps(p_user_id)
--     → authenticated 非オーナー向け。DB 層でカラムマスクを保証。
--       本人・admin は全カラム / それ以外は salary_man=NULL, company_text=NULL(masked時)
--
-- 公開制御の主従（Migration 175 定義を継承）:
--   is_published (ow_career_profiles) AND ow_users.visibility — 矛盾時は厳しい方優先
-- ================================================================

-- ----------------------------------------------------------------
-- (A) ow_experiences の公開系 SELECT ポリシーを更新
--     visibility_company='hidden' の行は公開クエリから除外する
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "ow_experiences_public_read"     ON ow_experiences;
DROP POLICY IF EXISTS "ow_experiences_login_only_read" ON ow_experiences;

-- 未認証（anon）: public ユーザーの hidden でないステップのみ
CREATE POLICY "ow_experiences_public_read"
  ON ow_experiences FOR SELECT
  USING (
    visibility_company <> 'hidden'
    AND user_id IN (
      SELECT id FROM ow_users WHERE visibility = 'public'
    )
  );

-- 認証済み（非オーナー含む）: public/login_only ユーザーの hidden でないステップのみ
CREATE POLICY "ow_experiences_login_only_read"
  ON ow_experiences FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND visibility_company <> 'hidden'
    AND user_id IN (
      SELECT id FROM ow_users WHERE visibility IN ('public', 'login_only')
    )
  );

-- ----------------------------------------------------------------
-- (B) anon ロールから salary_man / company_text カラム権限を剥奪
--     anon キーによる直叩き（curl /rest/v1/ow_experiences?select=salary_man）で
--     これらのカラムが NULL を返すようになる。
--     ※ authenticated ロールには別途 (C) の関数で対処する。
-- ----------------------------------------------------------------

REVOKE SELECT (salary_man, company_text) ON ow_experiences FROM anon;

-- ----------------------------------------------------------------
-- (C) SECURITY DEFINER 関数: get_public_career_steps(p_user_id)
--     ・本人 / admin  → 全カラムを返す（salary_man 含む）
--     ・それ以外      → salary_man=NULL, hidden 行除外,
--                       visibility_company='masked' 時は company_text=NULL
--     ・visibility_salary=false の行も salary_man=NULL で返す（二重保護）
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
    -- それ以外: salary_man=NULL, company_text はvisibility に従いマスク,
    --           hidden 行を除外, ow_users.visibility ゲートも適用
    RETURN QUERY
      SELECT
        e.id,
        e.user_id,
        -- 企業FK: real のみ公開
        CASE WHEN e.visibility_company = 'real' THEN e.company_id ELSE NULL::UUID END,
        -- 企業実名: real のみ公開
        CASE WHEN e.visibility_company = 'real' THEN e.company_text ELSE NULL::TEXT END,
        e.company_anonymized,
        e.role_category_id,
        e.role_title,
        e.started_at,
        e.ended_at,
        e.is_current,
        e.description,
        e.display_order,
        -- 転職理由: visibility_reason=false なら NULL
        CASE WHEN e.visibility_reason THEN e.join_reason ELSE NULL::TEXT END,
        e.employment_type,
        -- 年収: 常に NULL（本人・admin 以外には返さない）
        NULL::INT,
        e.visibility_company,
        e.visibility_salary,
        e.visibility_reason,
        e.created_at,
        e.updated_at
      FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
      WHERE e.user_id = p_user_id
        AND e.visibility_company <> 'hidden'
        AND (
          u.visibility = 'public'
          OR (auth.uid() IS NOT NULL AND u.visibility = 'login_only')
        )
      ORDER BY e.display_order;
  END IF;
END;
$$;

-- authenticated ロールにこの関数の実行権限を付与
GRANT EXECUTE ON FUNCTION get_public_career_steps(UUID) TO authenticated, anon;
