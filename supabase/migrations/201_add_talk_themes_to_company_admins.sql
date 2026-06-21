-- migration 201: ow_company_admins に talk_themes を追加
-- 「話せる人」ページで表示する相談テーマタグを管理者が設定可能にする

ALTER TABLE ow_company_admins
  ADD COLUMN IF NOT EXISTS talk_themes TEXT[] DEFAULT '{}';
