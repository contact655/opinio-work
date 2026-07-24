-- Migration 271: ow_company_departments に論理削除カラムを追加
-- ON DELETE SET NULL のまま物理削除すると削除履歴が消えるため、
-- 削除操作を deleted_at のセットに変更し参照を保持する

ALTER TABLE ow_company_departments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 既存 RLS ポリシーは auth_is_company_admin + public read 構成のまま維持
-- アプリ側クエリで .is('deleted_at', null) フィルタを追加すること
