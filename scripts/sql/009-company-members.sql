CREATE TABLE IF NOT EXISTS company_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),

  -- 登録者
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 所属企業
  company_id uuid REFERENCES ow_companies(id) ON DELETE CASCADE,

  -- 基本情報
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('current', 'alumni')),
  department text,
  role text NOT NULL,

  -- 在籍期間
  joined_year int,
  left_year int,

  -- 社内経験
  experience text,

  -- 一言コメント
  good_points text,
  hard_points text,

  -- 公開設定
  is_public boolean DEFAULT true,

  UNIQUE(user_id, company_id)
);

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public members are viewable by everyone"
  ON company_members FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can insert own membership"
  ON company_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own membership"
  ON company_members FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own membership"
  ON company_members FOR DELETE
  USING (auth.uid() = user_id);
