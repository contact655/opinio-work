-- Migration 130: Add category to ow_user_skill_tags
-- スキルタグにカテゴリを追加（技術・開発 / プロダクト・UX / ビジネス・営業 / マーケティング / データ・分析 / マネジメント / その他）

ALTER TABLE ow_user_skill_tags
  ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN ow_user_skill_tags.category IS 'スキルカテゴリ（技術・開発 / プロダクト・UX / ビジネス・営業 / マーケティング / データ・分析 / マネジメント / その他）';
