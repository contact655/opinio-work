-- 職歴テーブル（求職者が登録 → 企業詳細メンバータブに自動表示）
CREATE TABLE work_histories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),

  -- 登録者（求職者）
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- 所属企業（ow_companiesテーブルと紐付け）
  company_id uuid REFERENCES ow_companies(id) ON DELETE CASCADE NOT NULL,

  -- 在籍情報
  status text NOT NULL CHECK (status IN ('current', 'alumni')),
  role text NOT NULL,
  department text,
  joined_year int NOT NULL,
  left_year int,

  -- 表示用コメント
  good_points text,
  hard_points text,

  -- 公開設定
  is_public boolean DEFAULT true,

  -- 1ユーザーにつき1社1登録
  UNIQUE(user_id, company_id)
);

-- RLS
ALTER TABLE work_histories ENABLE ROW LEVEL SECURITY;

-- 公開設定のものは誰でも閲覧可能
CREATE POLICY "Public work histories viewable by all"
  ON work_histories FOR SELECT
  USING (is_public = true);

-- 自分のレコードは非公開でも閲覧可能
CREATE POLICY "Users can view own work histories"
  ON work_histories FOR SELECT
  USING (auth.uid() = user_id);

-- 自分のレコードのみ操作可能
CREATE POLICY "Users can insert own work history"
  ON work_histories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own work history"
  ON work_histories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own work history"
  ON work_histories FOR DELETE
  USING (auth.uid() = user_id);
