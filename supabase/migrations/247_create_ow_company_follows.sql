-- Migration 247: ow_company_follows (idempotent — already applied to prod)
CREATE TABLE IF NOT EXISTS ow_company_follows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_user_id UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  company_id       UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_follows_user    ON ow_company_follows(follower_user_id);
CREATE INDEX IF NOT EXISTS idx_company_follows_company ON ow_company_follows(company_id);

-- RLS
ALTER TABLE ow_company_follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ow_company_follows' AND policyname = 'users can manage own follows'
  ) THEN
    CREATE POLICY "users can manage own follows"
      ON ow_company_follows
      FOR ALL
      USING (follower_user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid()))
      WITH CHECK (follower_user_id = (SELECT id FROM ow_users WHERE auth_id = auth.uid()));
  END IF;
END $$;
