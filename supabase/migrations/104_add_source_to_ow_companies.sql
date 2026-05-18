-- migration 104: ow_companies に source 列を追加 + Salesforce 1件 INSERT
-- 作成日: 2026-05-18
-- 目的:
--   - 企業マスタの「出所（source）」を表現するカラムを追加する
--   - 値: 'admin_seed'（ADMIN 登録）/ 'self_serve'（企業セルフ登録）/ NULL（未分類・要個別判断）
--   - 既存 34 件は user_id の有無が混在しており一律分類不可 → NULL のまま（バックフィルしない）
--   - Salesforce 1件を admin_seed として新規 INSERT する
-- 参照: docs/company-master-operation-model.md

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 本体 (UP)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- (1) source 列を追加
--   nullable・デフォルトなし（既存行は NULL のまま）
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS source text;

-- (2) Salesforce 1件を admin_seed として INSERT
--   is_published = false（既存の admin_seed 運用と統一）
--   logo_url = NULL（ロゴ未登録）
--   その他カラムはテーブルデフォルトに委ねる
INSERT INTO ow_companies (name, source, logo_url, is_published)
VALUES ('株式会社セールスフォース・ジャパン', 'admin_seed', NULL, false);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ロールバック手順 (DOWN)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 以下を Supabase SQL Editor で手動実行する。
-- ※ Salesforce の行を特定するため name で削除する。
--    他に同名行が存在しない前提（INSERT 前に SELECT で確認すること）。
--
-- -- (A) Salesforce INSERT を取り消す
-- DELETE FROM ow_companies
--   WHERE name = '株式会社セールスフォース・ジャパン'
--     AND source = 'admin_seed';
--
-- -- (B) source 列を削除する
-- ALTER TABLE ow_companies DROP COLUMN IF EXISTS source;
