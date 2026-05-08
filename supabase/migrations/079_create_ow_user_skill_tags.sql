-- ν-8 段階1: スキルタグテーブル新規作成
-- ν-8 では完全自由入力、ν-9 以降でマスタ化検討（master_id カラムで伏線）

CREATE TABLE ow_user_skill_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  master_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ow_user_skill_tags_label_length CHECK (char_length(label) BETWEEN 1 AND 50)
);

CREATE INDEX ow_user_skill_tags_user_id_idx ON ow_user_skill_tags(user_id);
CREATE INDEX ow_user_skill_tags_label_idx ON ow_user_skill_tags(label);

COMMENT ON TABLE ow_user_skill_tags IS 'ユーザーのスキルタグ。ν-8 では自由入力、ν-9 以降でマスタ化を検討（master_id 伏線）。';
COMMENT ON COLUMN ow_user_skill_tags.label IS 'タグ表示文字列。ν-8 では自由入力、1〜50字。';
COMMENT ON COLUMN ow_user_skill_tags.sort_order IS '入力順を保持するための整数。フロントで上限15個ソフトリミット。';
COMMENT ON COLUMN ow_user_skill_tags.master_id IS 'ν-9 以降でスキルマスタ化したときの fk。ν-8 では常に null。';

ALTER TABLE ow_user_skill_tags ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが閲覧可能（公開プロフィール）
CREATE POLICY "ow_user_skill_tags_select_all"
  ON ow_user_skill_tags FOR SELECT USING (true);

-- 自分のレコードのみ INSERT 可
-- 既存パターン: user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
CREATE POLICY "ow_user_skill_tags_insert_own"
  ON ow_user_skill_tags FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

-- 自分のレコードのみ UPDATE 可
CREATE POLICY "ow_user_skill_tags_update_own"
  ON ow_user_skill_tags FOR UPDATE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));

-- 自分のレコードのみ DELETE 可
CREATE POLICY "ow_user_skill_tags_delete_own"
  ON ow_user_skill_tags FOR DELETE
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));
