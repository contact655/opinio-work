-- ユーザーロール管理テーブル
-- 1ユーザーが複数のロール（candidate, company, admin）を持てる
CREATE TABLE IF NOT EXISTS ow_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('candidate', 'company', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- RLS有効化
ALTER TABLE ow_user_roles ENABLE ROW LEVEL SECURITY;

-- 自分のロールは読み取り可能
CREATE POLICY "ow_user_roles_own_read" ON ow_user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 自分のロールは挿入可能
CREATE POLICY "ow_user_roles_own_insert" ON ow_user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- admin用：全ロール読み取り（admin画面のプロフィール閲覧用）
CREATE POLICY "ow_user_roles_admin_read" ON ow_user_roles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ow_companiesの公開読み取りポリシーを追加（pending/inactive含めてオーナーは読める）
-- 既存ポリシーはstatusがactiveのみ読み取り可能だが、オーナーは自分の企業を読みたい
-- ow_companies_own_manage で ALL が設定済みなので追加不要

-- ow_profiles にadminからの読み取りポリシーを追加
CREATE POLICY "ow_profiles_admin_read" ON ow_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
