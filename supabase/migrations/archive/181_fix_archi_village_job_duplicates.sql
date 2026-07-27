-- Migration 181: Archi Village 求人重複削除
-- Migration 168 が5回適用されたため 18件 → 90件になっていた
-- 最古（2026-06-12）を正とし、それ以降の4回分（72件）を削除

DELETE FROM ow_jobs
WHERE company_id = 'f1481f96-94c8-4515-a52e-a853ede66080'
  AND created_at > '2026-06-13 00:00:00+00';
