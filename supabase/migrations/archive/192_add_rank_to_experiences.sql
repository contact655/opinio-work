-- Migration 192: ow_experiences に役職グレードカラムを追加
-- rank = 標準化された役職レベル（select 選択肢）
-- role_title（既存）= 社内独自タイトル（自由入力: "アカウントエグゼクティブ" 等）

ALTER TABLE ow_experiences
  ADD COLUMN IF NOT EXISTS rank TEXT
  CONSTRAINT ow_experiences_rank_check
    CHECK (rank IN ('none', 'leader', 'manager', 'general_manager', 'executive'));

COMMENT ON COLUMN ow_experiences.rank IS
  '役職グレード: none=役職なし / leader=係長・リーダー / manager=課長・マネージャー / general_manager=部長・GM / executive=役員';
