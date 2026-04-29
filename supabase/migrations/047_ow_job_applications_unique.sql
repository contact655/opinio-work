-- migration 047: UNIQUE(user_id, job_id) constraint on ow_job_applications
-- 目的: race condition による重複応募を DB レベルで完全防止
-- 背景: Commit L でアプリ層チェック実装済みだが SELECT → INSERT 間の
--       race condition が残存。DB 制約で二重防御（Defense in Depth）。
--
-- Pre-check (2026-04-30): 既存行 0 件、重複なし → 安全に適用可能
--
-- Rollback: ALTER TABLE ow_job_applications DROP CONSTRAINT ow_job_applications_user_job_unique;

ALTER TABLE ow_job_applications
  ADD CONSTRAINT ow_job_applications_user_job_unique
  UNIQUE (user_id, job_id);
