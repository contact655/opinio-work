-- Migration 212: セールス職専用構造化項目を ow_jobs に追加
-- ow_jobs の job_category = '営業' の求人でのみ使用する。
-- 全カラム nullable。既存 180 件の求人は未入力（NULL）のまま正常動作する。

ALTER TABLE ow_jobs
  ADD COLUMN IF NOT EXISTS ote_min          INT          DEFAULT NULL, -- OTE下限（万円）
  ADD COLUMN IF NOT EXISTS ote_max          INT          DEFAULT NULL, -- OTE上限（万円）
  ADD COLUMN IF NOT EXISTS sales_segment    TEXT[]       DEFAULT NULL, -- 担当セグメント: "smb"/"mid"/"enterprise"
  ADD COLUMN IF NOT EXISTS sales_hunter_farmer TEXT       DEFAULT NULL, -- 新規/既存傾向: "hunter"/"farmer"/"balanced"
  ADD COLUMN IF NOT EXISTS incentive_note   TEXT         DEFAULT NULL; -- インセンティブ補足（自由記述）

-- コメント
COMMENT ON COLUMN ow_jobs.ote_min          IS 'OTE下限（万円）。job_category=営業のときのみ使用。インセンティブ込み想定年収。';
COMMENT ON COLUMN ow_jobs.ote_max          IS 'OTE上限（万円）。job_category=営業のときのみ使用。';
COMMENT ON COLUMN ow_jobs.sales_segment    IS '担当セグメント配列。値: smb / mid / enterprise';
COMMENT ON COLUMN ow_jobs.sales_hunter_farmer IS '新規/既存傾向。値: hunter（新規中心）/ farmer（既存中心）/ balanced（半々）';
COMMENT ON COLUMN ow_jobs.incentive_note   IS 'インセンティブ・コミッション補足説明（任意自由記述）';
