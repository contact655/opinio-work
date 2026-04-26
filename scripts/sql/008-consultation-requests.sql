CREATE TABLE IF NOT EXISTS consultation_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),

  -- 申し込み者
  user_id uuid REFERENCES auth.users(id),
  user_name text NOT NULL,
  user_email text NOT NULL,

  -- 希望メンター
  mentor_id uuid REFERENCES mentors(id),
  mentor_name text NOT NULL,

  -- 相談内容
  message text NOT NULL,
  preferred_time text,

  -- 運営管理
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_note text
);

ALTER TABLE consultation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON consultation_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own requests"
  ON consultation_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
