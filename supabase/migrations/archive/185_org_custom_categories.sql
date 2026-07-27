-- Migration 185: ow_company_employee_categories にカスタム名サポートを追加
-- role_id を nullable に変更 + custom_name カラム追加
-- カスタムカテゴリ = role_id IS NULL AND custom_name IS NOT NULL

ALTER TABLE ow_company_employee_categories
  ALTER COLUMN role_id DROP NOT NULL,
  ADD COLUMN custom_name TEXT;

-- カスタム名の重複を防ぐ partial ユニーク制約（同一企業・同一カスタム名は不可）
CREATE UNIQUE INDEX ow_company_employee_categories_custom_name_unique
  ON ow_company_employee_categories (company_id, custom_name)
  WHERE custom_name IS NOT NULL;

-- バリデーション: role_id と custom_name のどちらか一方が必ず存在する
ALTER TABLE ow_company_employee_categories
  ADD CONSTRAINT ow_company_employee_categories_role_or_custom
  CHECK (role_id IS NOT NULL OR custom_name IS NOT NULL);
