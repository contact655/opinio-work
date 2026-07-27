-- ───────────────────────────────────────────────────
-- Fix 17: Scout opt-ins
-- ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ow_scout_opt_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_ow_scout_opt_ins_user ON ow_scout_opt_ins(user_id);
CREATE INDEX IF NOT EXISTS idx_ow_scout_opt_ins_company ON ow_scout_opt_ins(company_id);

ALTER TABLE ow_scout_opt_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can view own opt-ins" ON ow_scout_opt_ins;
CREATE POLICY "users can view own opt-ins" ON ow_scout_opt_ins
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can create own opt-ins" ON ow_scout_opt_ins;
CREATE POLICY "users can create own opt-ins" ON ow_scout_opt_ins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can delete own opt-ins" ON ow_scout_opt_ins;
CREATE POLICY "users can delete own opt-ins" ON ow_scout_opt_ins
  FOR DELETE USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────
-- Fix 18: Comparison lists (per-user persisted lists)
-- ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ow_comparison_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  company_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ow_comparison_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own comparison" ON ow_comparison_lists;
CREATE POLICY "users manage own comparison" ON ow_comparison_lists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ───────────────────────────────────────────────────
-- Fix 22: Member career history (article_content already added in 022)
-- ───────────────────────────────────────────────────
ALTER TABLE ow_company_members
ADD COLUMN IF NOT EXISTS career_history jsonb;

ALTER TABLE ow_company_members
ADD COLUMN IF NOT EXISTS interviewer text;
