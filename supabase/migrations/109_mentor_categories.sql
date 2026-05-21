-- migration: 109_mentor_categories.sql
-- メンターと悩みカテゴリの多対多紐付けテーブルを作成する

CREATE TABLE ow_mentor_categories (
  mentor_user_id UUID REFERENCES ow_users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES ow_consultation_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (mentor_user_id, category_id)
);

CREATE INDEX idx_mentor_categories_mentor   ON ow_mentor_categories(mentor_user_id);
CREATE INDEX idx_mentor_categories_category ON ow_mentor_categories(category_id);
