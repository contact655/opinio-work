-- Migration 150: culture_keywords カラム追加
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS culture_keywords TEXT[];

-- Salesforce Japan のカルチャーキーワード
UPDATE ow_companies
SET culture_keywords = ARRAY[
  'Ohana（家族）文化',
  '多様性・インクルージョン',
  '心理的安全性',
  'ボランティア文化（年7日）',
  'グローバル環境',
  '実力主義・成果評価'
]
WHERE id = 'c3664ef1-5571-4645-b30f-1474e7961c17';
