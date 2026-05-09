-- ν-8 段階1: 企業ロゴ表示のための logo_url カラムを追加
-- 運営が手動登録（Supabase Studio から直接 UPDATE）
--
-- A3 べき等化: ν-7 以前のセッションで Studio から手動適用済みの可能性があるため
-- ADD COLUMN IF NOT EXISTS に変更。

ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN ow_companies.logo_url IS '企業ロゴ画像URL。運営が手動登録（Supabase Studio から直接 UPDATE）。null のとき logo_letter + logo_gradient でフォールバック表示。';
