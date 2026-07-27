-- Migration 211: ow_companies / ow_jobs に business_model を一括設定
-- 判断根拠: Step 2 マッピング案（2026-07-10 ユーザー承認済み）
--   consulting: 日本IBM株式会社（日本法人はコンサルティング主体）
--   other: 株式会社irodas（新卒エージェント＋SaaSの混合形態、保留扱い）
--   product: 上記2社以外の全社（自社SaaS・プロダクト・ハードウェアメーカー含む）

-- Step 1: ow_companies 全件に business_model を設定（現在 80社全件 NULL）
UPDATE ow_companies
SET business_model = CASE
  WHEN name ILIKE '%IBM%' OR name ILIKE '%アイ・ビー・エム%' THEN 'consulting'
  WHEN name ILIKE '%irodas%'                                   THEN 'other'
  ELSE 'product'
END
WHERE business_model IS NULL;

-- Step 2: ow_jobs 全件に company の business_model を継承（現在 180件全件 NULL）
UPDATE ow_jobs j
SET business_model = c.business_model
FROM ow_companies c
WHERE j.company_id = c.id
  AND j.business_model IS NULL;

-- 結果確認クエリ（実行後にこれで検証してください）
-- SELECT business_model, COUNT(*) FROM ow_companies GROUP BY business_model ORDER BY 2 DESC;
-- SELECT business_model, COUNT(*) FROM ow_jobs     GROUP BY business_model ORDER BY 2 DESC;
