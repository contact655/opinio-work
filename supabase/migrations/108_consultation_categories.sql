-- migration: 108_consultation_categories.sql
-- 悩みカテゴリマスタテーブルを作成し、初期データを投入する

CREATE TABLE ow_consultation_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ow_consultation_categories (slug, name, description, sort_order) VALUES
  ('career_direction',  'キャリアの方向性に迷っている',    '自分のキャリア軸を見つけたい',              10),
  ('market_value',      '自分の市場価値が知りたい',          '今の自分の立ち位置を確認したい',            20),
  ('job_change_timing', '転職するか迷っている',              '動くべきタイミングを相談したい',            30),
  ('current_company',   '今の会社にいるべきか分からない',    '残るか出るかの判断に迷っている',            40),
  ('side_business',     '副業/独立を考えている',             '新しい働き方を模索したい',                  50),
  ('relationship',      '人間関係/組織に悩んでいる',         '上司・同僚・チームのことを話したい',        60);
