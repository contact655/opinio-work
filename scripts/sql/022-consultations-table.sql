-- 022: 相談予約（consultations）テーブルを作成
CREATE TABLE IF NOT EXISTS consultations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id uuid REFERENCES mentors(id),
  user_id uuid,
  message text,
  preferred_date text,
  status text DEFAULT 'pending',  -- pending / confirmed / completed / cancelled
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の相談予約を閲覧可能
CREATE POLICY "users can see own consultations" ON consultations
  FOR SELECT USING (auth.uid() = user_id);

-- ユーザーは相談予約を作成可能
CREATE POLICY "users can insert consultations" ON consultations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service roleキーでのアクセスは常に許可（API経由）
