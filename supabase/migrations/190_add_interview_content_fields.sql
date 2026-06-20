-- Migration 190: インタビューコンテンツフィールド追加
-- ow_experiences に turning_point / exit_reason を追加
-- get_public_career_steps() を更新して4フィールド全て返す

-- ── 1. 新カラム追加 ────────────────────────────────────────────
ALTER TABLE ow_experiences
  ADD COLUMN IF NOT EXISTS turning_point TEXT,
  ADD COLUMN IF NOT EXISTS exit_reason   TEXT;

-- ── 2. get_public_career_steps() 更新 ─────────────────────────
-- 戻り型を変更するため DROP してから再作成
-- visibility_reason=true のとき join_reason / turning_point / exit_reason を返す
-- description は常に返す（職務記述は機密性が低い）
DROP FUNCTION IF EXISTS get_public_career_steps(UUID);

CREATE FUNCTION get_public_career_steps(p_user_id UUID)
RETURNS TABLE (
  id                 UUID,
  user_id            UUID,
  company_id         UUID,
  company_text       TEXT,
  company_anonymized TEXT,
  role_category_id   UUID,
  role_title         TEXT,
  started_at         TEXT,
  ended_at           TEXT,
  is_current         BOOLEAN,
  description        TEXT,
  join_reason        TEXT,
  turning_point      TEXT,
  exit_reason        TEXT,
  employment_type    TEXT,
  salary_man         INTEGER,
  visibility_company TEXT,
  visibility_salary  BOOLEAN,
  visibility_reason  BOOLEAN,
  display_order      INTEGER
)
SECURITY DEFINER
SET search_path = public
SET row_security = off
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_published BOOLEAN;
  v_caller_id    UUID;
BEGIN
  SELECT is_published INTO v_is_published
  FROM public.ow_career_profiles
  WHERE ow_career_profiles.user_id = p_user_id;

  v_caller_id := auth.uid();

  -- オーナー本人 OR 公開済みの場合のみ返す
  IF v_is_published IS TRUE OR v_caller_id = p_user_id THEN
    RETURN QUERY
    SELECT
      e.id,
      e.user_id,
      e.company_id,
      e.company_text,
      e.company_anonymized,
      e.role_category_id,
      e.role_title,
      e.started_at::TEXT,
      e.ended_at::TEXT,
      e.is_current,
      e.description,
      CASE WHEN e.visibility_reason THEN e.join_reason   ELSE NULL END,
      CASE WHEN e.visibility_reason THEN e.turning_point ELSE NULL END,
      CASE WHEN e.visibility_reason THEN e.exit_reason   ELSE NULL END,
      e.employment_type,
      CASE WHEN e.visibility_salary THEN e.salary_man    ELSE NULL END,
      e.visibility_company::TEXT,
      e.visibility_salary,
      e.visibility_reason,
      e.display_order
    FROM public.ow_experiences e
    WHERE e.user_id = p_user_id
      AND e.visibility_company::TEXT != 'hidden';
  END IF;
END;
$$;
