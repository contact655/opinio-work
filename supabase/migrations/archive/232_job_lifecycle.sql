-- Migration 232: 求人ライフサイクル設計
-- status に draft / closed / expired を追加
-- expires_at を既存74件に NOW() + 90日 でバックフィル
-- 新規公開時のデフォルトは アプリ側で published_at + 90日 を設定する

-- 1. status カラムの CHECK 制約を拡張（または制約なし TEXT の場合はそのまま）
--    現状 TEXT 型で enum 制約がないことを確認済みのため、
--    有効値ドキュメントとして migration に明記するのみ
--    有効 status: draft / published / closed / expired

-- 2. expires_at を既存 published 求人に NOW() + 90日 でバックフィル
UPDATE ow_jobs
SET expires_at = NOW() + INTERVAL '90 days'
WHERE status IN ('active', 'published')
  AND expires_at IS NULL;
