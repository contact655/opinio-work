-- =====================================================
-- Phase Q: 企業ごとの社員カテゴリ表示設定
--
-- 各企業が「現役社員セクションでどのカテゴリを表示するか」
-- および「表示順」を選択可能にする中間テーブル。
--
-- マスタ統制: ow_roles を全社共通マスタとして使用
-- 横断検索可能: /companies?category={role_id} 等で活用
-- =====================================================

CREATE TABLE ow_company_employee_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES ow_roles(id),
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 同じ企業内で同じ role を 2 回登録できない
  UNIQUE (company_id, role_id)
);

-- 企業ごとの取得を高速化
CREATE INDEX idx_ow_company_employee_categories_company_id
  ON ow_company_employee_categories(company_id);

-- 表示順での取得を高速化
CREATE INDEX idx_ow_company_employee_categories_display_order
  ON ow_company_employee_categories(company_id, display_order);

COMMENT ON TABLE ow_company_employee_categories IS
  'Phase Q: 企業ごとの現役社員カテゴリ表示設定。各企業がow_rolesから選択し、表示順を指定する。';
