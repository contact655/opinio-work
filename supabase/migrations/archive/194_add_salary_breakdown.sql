-- Migration 194: ow_experiences に年収内訳カラムを追加
-- salary_man（既存）= 合計年収（万円）→ salary_base + salary_bonus + salary_stock の合算値として保存
-- salary_base  = ベースの給与（基本給・残業代合計、万円）
-- salary_bonus = 賞与・インセンティブ（年間、万円）
-- salary_stock = 株式報酬（RSU/SO年間換算、万円）

ALTER TABLE ow_experiences
  ADD COLUMN IF NOT EXISTS salary_base  INT,
  ADD COLUMN IF NOT EXISTS salary_bonus INT,
  ADD COLUMN IF NOT EXISTS salary_stock INT;

COMMENT ON COLUMN ow_experiences.salary_base  IS '年収内訳: ベースの給与（基本給＋残業代等の合計、万円）';
COMMENT ON COLUMN ow_experiences.salary_bonus IS '年収内訳: 賞与・インセンティブ（年間合計、万円）';
COMMENT ON COLUMN ow_experiences.salary_stock IS '年収内訳: 株式報酬（RSU/SO 年間換算額、万円）';
