-- ───────────────────────────────────────────────────
-- Fix 17: Scout opt-in flag (for future scout feature)
-- ───────────────────────────────────────────────────
ALTER TABLE ow_user_profiles
ADD COLUMN IF NOT EXISTS scout_enabled_company_ids uuid[];

-- ───────────────────────────────────────────────────
-- Fix 20: Company follow for new-job notifications
-- ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ow_company_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_ow_company_follows_user ON ow_company_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_ow_company_follows_company ON ow_company_follows(company_id);

-- RLS
ALTER TABLE ow_company_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can view own follows" ON ow_company_follows;
CREATE POLICY "users can view own follows" ON ow_company_follows
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can follow companies" ON ow_company_follows;
CREATE POLICY "users can follow companies" ON ow_company_follows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can unfollow companies" ON ow_company_follows;
CREATE POLICY "users can unfollow companies" ON ow_company_follows
  FOR DELETE USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────
-- Fix 21: Social/official links (JSONB)
-- ───────────────────────────────────────────────────
ALTER TABLE ow_companies
ADD COLUMN IF NOT EXISTS social_links jsonb;

-- Example structure:
-- {
--   "twitter": "https://x.com/foo",
--   "note": "https://note.com/foo",
--   "youtube": "https://youtube.com/@foo",
--   "blog": "https://foo.com/blog",
--   "wantedly": "https://wantedly.com/companies/foo"
-- }

-- ───────────────────────────────────────────────────
-- Fix 22: Member interview article content
-- ───────────────────────────────────────────────────
ALTER TABLE ow_company_members
ADD COLUMN IF NOT EXISTS article_title text;

ALTER TABLE ow_company_members
ADD COLUMN IF NOT EXISTS article_content text;

ALTER TABLE ow_company_members
ADD COLUMN IF NOT EXISTS article_published_at timestamptz;
