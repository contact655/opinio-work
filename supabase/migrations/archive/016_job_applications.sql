-- 応募テーブル
CREATE TABLE IF NOT EXISTS ow_job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES ow_jobs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text,
  resume_url text,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ow_job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can insert own applications"
  ON ow_job_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "users can read own applications"
  ON ow_job_applications FOR SELECT
  USING (auth.uid() = user_id);
