-- Migration 113: ow_jobs.status "active" → "published" 統一
-- 旧来のステータス値 "active" と新しい値 "published" の不整合を解消。
-- biz側コード（VALID_STATUSES, getJobStatusCounts 等）は "published" を期待しているため。

UPDATE ow_jobs
SET status = 'published'
WHERE status = 'active';
