-- Migration 257: expires_at を全求人で NULL に戻す
-- 理由: 期限管理不要。Migration 232 で設定した 2026-10-12 の expires_at を削除。
-- getJobs() は status で絞っており、expires_at フィルターは存在しないため
-- 実際の表示には影響しないが、将来の cron 誤作動を防ぐ。
UPDATE ow_jobs
SET expires_at = NULL
WHERE expires_at IS NOT NULL;
