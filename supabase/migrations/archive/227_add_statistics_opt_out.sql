-- Migration 227: Add statistics_opt_out flag to ow_users
--
-- 統計利用のopt-out管理フラグ。
-- opt-out方式のため DEFAULT false（= 統計利用を許諾している状態）。
-- ユーザーが停止請求をした場合に true に更新する（運用: contact@opinio.co.jp 経由で手動対応）。
--
-- ⚠️ 重要な運用ルール:
-- 将来、統計データを集計する全てのクエリは、必ず以下の条件で除外すること:
--
--   WHERE ow_users.statistics_opt_out = false
--
-- この除外を忘れると求職者利用規約 第13条の4 第5項に違反する。

ALTER TABLE ow_users
  ADD COLUMN IF NOT EXISTS statistics_opt_out BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ow_users.statistics_opt_out IS
  'true = ユーザーが統計利用の停止を請求済み。集計クエリでは必ず WHERE statistics_opt_out = false を付けること（規約第13条の4第5項）。';
