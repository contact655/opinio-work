-- Migration 272: ow_company_job_roles の public read ポリシーを削除
--
-- 問題: "public read active job roles" は deleted_at IS NULL のみが条件で
--       company_id 制限がなく、anon ロールが全企業の職種名を読める状態だった。
--
-- 修正: public ポリシーを削除し、管理者専用の1ポリシーのみに戻す。
--       求人詳細ページ等で職種名が必要な場合は adminSupabase 経由の JOIN で取得する。

DROP POLICY IF EXISTS "public read active job roles" ON ow_company_job_roles;

-- 残るポリシーの確認用（コメント）:
-- "company admins manage job roles" FOR ALL USING (auth_is_company_admin(company_id))
-- これのみが残り、自社の管理者だけが自社の職種を参照・操作できる。
