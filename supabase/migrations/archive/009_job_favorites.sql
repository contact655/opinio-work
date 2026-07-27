-- ─── ow_job_favorites table ─────────────────────────
CREATE TABLE IF NOT EXISTS ow_job_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES ow_jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, job_id)
);

-- RLS
ALTER TABLE ow_job_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own job favorites"
  ON ow_job_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own job favorites"
  ON ow_job_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own job favorites"
  ON ow_job_favorites FOR DELETE
  USING (auth.uid() = user_id);
