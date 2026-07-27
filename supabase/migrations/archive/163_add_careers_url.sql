-- Migration 163: ow_companies に careers_url カラムを追加
-- 企業詳細ページ・biz企業編集画面での採用ページ直リンクに使用
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS careers_url TEXT;
