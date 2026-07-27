-- Migration 186: カスタムカテゴリに親カテゴリ指定を追加
-- parent_role_id: ow_roles の親カテゴリを参照（カスタムカテゴリが既存の親グループに属する場合）

ALTER TABLE ow_company_employee_categories
  ADD COLUMN parent_role_id UUID REFERENCES ow_roles(id) ON DELETE SET NULL;
