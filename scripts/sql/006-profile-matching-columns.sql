-- Add matching-related columns to ow_profiles
ALTER TABLE ow_profiles
  ADD COLUMN IF NOT EXISTS consultation_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS current_company_type text;

-- consultation_tags: ['年収交渉', '外資転職', 'キャリアチェンジ', ...]
-- current_company_type: '日系大手', '外資系', 'SaaS', 'SIer', '人材', 'コンサル', 'スタートアップ', 'その他'
