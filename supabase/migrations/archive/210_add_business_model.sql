-- Migration 210: 業態タグ（business_model）を ow_jobs と ow_companies に追加
-- 求人単位で「SaaS / 自社プロダクト / コンサルティング / 受託開発・SES / SI・システム構築 / その他」
-- を持たせ、業界（ドメイン）と提供形態を別軸で絞り込めるようにする。
-- 既存データは NULL 許容（段階的に埋める運用）。

ALTER TABLE ow_jobs
  ADD COLUMN IF NOT EXISTS business_model TEXT;

ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS business_model TEXT;

COMMENT ON COLUMN ow_jobs.business_model IS
  '業態タグ: saas / product / consulting / outsourcing / si / other';
COMMENT ON COLUMN ow_companies.business_model IS
  '企業デフォルト業態タグ。求人未設定時のフォールバック用: saas / product / consulting / outsourcing / si / other';
