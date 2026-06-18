-- ================================================================
-- Migration 175: キャリア軌跡 Phase 1 — データモデル構築
-- ================================================================
-- 公開制御の主従:
--   is_published = 軌跡の公開スイッチ（運営者が操作）
--   ow_users.visibility = ユーザー全体の可視性
--   矛盾する場合（visibility='private' かつ is_published=true 等）は
--   より厳しい方を優先。RLS は AND 条件で両方を要求する。
-- ================================================================

-- ----------------------------------------------------------------
-- (A) ow_career_profiles — 軌跡の公開エンベロープ（1ユーザー1行）
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ow_career_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL UNIQUE REFERENCES ow_users(id) ON DELETE CASCADE,
  headline            TEXT,
  years_of_experience INT,
  is_published        BOOLEAN     NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION ow_career_profiles_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ow_career_profiles_updated_at
  BEFORE UPDATE ON ow_career_profiles
  FOR EACH ROW EXECUTE FUNCTION ow_career_profiles_set_updated_at();

-- ----------------------------------------------------------------
-- (B) ow_experiences に 4 カラム追加
-- ----------------------------------------------------------------
-- visibility_company: 企業名の公開レベル
--   'real'   = 実名表示
--   'masked' = company_anonymized の匿名ラベルを表示（デフォルト）
--   'hidden' = このステップごと非表示
-- visibility_salary: 年収を公開するか（既存12行は false で安全側）
-- visibility_reason: 転職理由（join_reason）を公開するか
-- salary_man: 年収（万円）—— 入力層の実データ

ALTER TABLE ow_experiences
  ADD COLUMN IF NOT EXISTS salary_man           INT,
  ADD COLUMN IF NOT EXISTS visibility_company   TEXT NOT NULL DEFAULT 'masked'
    CHECK (visibility_company IN ('real', 'masked', 'hidden')),
  ADD COLUMN IF NOT EXISTS visibility_salary    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visibility_reason    BOOLEAN NOT NULL DEFAULT true;

-- 既存12行: 年収は機微情報なので visibility_salary を明示的に false に留める
-- （DEFAULT false のため ALTER だけで確定するが、意図を明示）
UPDATE ow_experiences
  SET visibility_salary = false
  WHERE visibility_salary IS NULL OR visibility_salary = true;
-- ↑ NULL はありえないが念のため。既存行に true を付けた場合も巻き戻す。

-- ----------------------------------------------------------------
-- (C) ow_career_follows — フォロー関係（フェーズ3の土台）
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ow_career_follows (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_user_id  UUID        NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  target_profile_id UUID        NOT NULL REFERENCES ow_career_profiles(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_user_id, target_profile_id)
);

-- ----------------------------------------------------------------
-- (D) RLS: ow_career_profiles
-- ----------------------------------------------------------------
ALTER TABLE ow_career_profiles ENABLE ROW LEVEL SECURITY;

-- 本人: 全操作（SELECT / INSERT / UPDATE / DELETE）
CREATE POLICY "career_profiles_own_manage"
  ON ow_career_profiles FOR ALL
  USING (
    user_id IN (
      SELECT id FROM ow_users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM ow_users WHERE auth_id = auth.uid()
    )
  );

-- admin: 全操作
CREATE POLICY "career_profiles_admin_all"
  ON ow_career_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ow_user_roles r
      JOIN ow_users u ON u.id = r.user_id
      WHERE u.auth_id = auth.uid() AND r.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ow_user_roles r
      JOIN ow_users u ON u.id = r.user_id
      WHERE u.auth_id = auth.uid() AND r.role = 'admin'
    )
  );

-- 未認証（anon）読み取り:
--   is_published=true AND ow_users.visibility='public'（より厳しい方を優先）
CREATE POLICY "career_profiles_public_read"
  ON ow_career_profiles FOR SELECT
  USING (
    is_published = true
    AND user_id IN (
      SELECT id FROM ow_users WHERE visibility = 'public'
    )
  );

-- 認証済み読み取り:
--   is_published=true AND ow_users.visibility IN ('public','login_only')
CREATE POLICY "career_profiles_login_read"
  ON ow_career_profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_published = true
    AND user_id IN (
      SELECT id FROM ow_users WHERE visibility IN ('public', 'login_only')
    )
  );

-- ----------------------------------------------------------------
-- (E) RLS: ow_career_follows
-- ----------------------------------------------------------------
ALTER TABLE ow_career_follows ENABLE ROW LEVEL SECURITY;

-- 本人（フォロワー）: 自分のフォロー行を管理
CREATE POLICY "career_follows_own_manage"
  ON ow_career_follows FOR ALL
  USING (
    follower_user_id IN (
      SELECT id FROM ow_users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    follower_user_id IN (
      SELECT id FROM ow_users WHERE auth_id = auth.uid()
    )
  );

-- 公開読み取り: 公開済みプロフィールへのフォロー行のみ閲覧可
CREATE POLICY "career_follows_read_published"
  ON ow_career_follows FOR SELECT
  USING (
    target_profile_id IN (
      SELECT cp.id FROM ow_career_profiles cp
      JOIN ow_users u ON u.id = cp.user_id
      WHERE cp.is_published = true AND u.visibility = 'public'
    )
  );
