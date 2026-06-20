-- Migration 183: ow_company_admins に is_ambassador カラム追加（「話せる人」機能）
-- 企業管理者が各メンバーに「話せる人」バッジを付与できる仕組み
-- is_ambassador=true のメンバーは求職者向け /people ページに表示される

ALTER TABLE public.ow_company_admins
  ADD COLUMN IF NOT EXISTS is_ambassador BOOLEAN DEFAULT false NOT NULL;

COMMENT ON COLUMN public.ow_company_admins.is_ambassador IS
  '話せる人バッジ: true のメンバーは求職者向け /people ページに表示される（企業管理者が設定）';
