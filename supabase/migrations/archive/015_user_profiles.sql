-- ユーザープロフィール（希望条件）テーブル
CREATE TABLE IF NOT EXISTS ow_user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_job_types text[],
  preferred_locations text[],
  salary_min integer,
  salary_max integer,
  work_style text,
  experience_years integer,
  current_job_type text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE ow_user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own profile"
  ON ow_user_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
