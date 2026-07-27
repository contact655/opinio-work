-- Migration 264: 企業アカウント開設時の同意記録カラム追加
-- 目的: 成果報酬15%の同意を ow_company_admins に記録する（後日紛争防止）

ALTER TABLE ow_company_admins
  ADD COLUMN IF NOT EXISTS agreed_terms_business BOOLEAN,
  ADD COLUMN IF NOT EXISTS agreed_fee_15pct BOOLEAN,
  ADD COLUMN IF NOT EXISTS agreed_terms_version TEXT,
  ADD COLUMN IF NOT EXISTS agreed_at TIMESTAMPTZ;

COMMENT ON COLUMN ow_company_admins.agreed_terms_business IS '企業向け利用規約・プライバシーポリシーへの同意フラグ';
COMMENT ON COLUMN ow_company_admins.agreed_fee_15pct IS '成果報酬15%（理論年収ベース）への同意フラグ';
COMMENT ON COLUMN ow_company_admins.agreed_terms_version IS '同意時の規約バージョン（例: 2026-07）';
COMMENT ON COLUMN ow_company_admins.agreed_at IS '同意日時';
