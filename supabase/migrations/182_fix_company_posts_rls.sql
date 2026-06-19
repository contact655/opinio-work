-- Migration 182: ow_company_posts RLS を ow_company_admins ベースに修正
-- 問題: Migration 145 の RLS が ow_user_roles を参照していたが、
--        実際の biz 認証は ow_company_admins を使用しているため INSERT が失敗していた

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "company_admin_all" ON ow_company_posts;

-- ow_company_admins を参照する正しいポリシーを作成
CREATE POLICY "company_admin_all"
  ON ow_company_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ow_company_admins ca
      JOIN ow_users ou ON ou.id = ca.user_id
      WHERE ou.auth_id = auth.uid()
        AND ca.company_id = ow_company_posts.company_id
        AND ca.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ow_company_admins ca
      JOIN ow_users ou ON ou.id = ca.user_id
      WHERE ou.auth_id = auth.uid()
        AND ca.company_id = ow_company_posts.company_id
        AND ca.is_active = true
    )
  );
