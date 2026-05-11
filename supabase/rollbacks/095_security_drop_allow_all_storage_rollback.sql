-- ============================================================
-- Rollback 095: Restore allow_all_storage policy
-- ============================================================
-- WARNING: このポリシーは未認証含む全員に全バケット全操作を許可する
-- セキュリティ負債です。緊急時のみ適用し、根本原因解消後は速やかに
-- 再度 migration 095 を適用してください。
-- ============================================================

CREATE POLICY "allow_all_storage" ON storage.objects
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
