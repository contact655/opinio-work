-- Migration 136: ow_companies 表示順序管理
-- 管理者がドラッグ&ドロップで企業カードの表示順を変更できるようにする

ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 既存企業に created_at 順で初期値設定
WITH ranked AS (
  SELECT id, ((ROW_NUMBER() OVER (ORDER BY created_at ASC)) - 1)::INTEGER AS rn
  FROM ow_companies
)
UPDATE ow_companies SET sort_order = ranked.rn
FROM ranked WHERE ow_companies.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_ow_companies_sort_order ON ow_companies(sort_order);

COMMENT ON COLUMN ow_companies.sort_order IS '企業カード表示順序（管理者がドラッグ&ドロップで変更可能。数値が小さいほど前に表示）';
