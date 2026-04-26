-- Fix 18: Newsletter subscribers
CREATE TABLE IF NOT EXISTS ow_newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  source text DEFAULT 'home_inline',
  subscribed_at timestamptz DEFAULT now(),
  unsubscribed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ow_newsletter_email ON ow_newsletter_subscribers(email);

-- Allow anonymous inserts (anyone can subscribe). RLS open for INSERT only.
ALTER TABLE ow_newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can subscribe" ON ow_newsletter_subscribers;
CREATE POLICY "anyone can subscribe" ON ow_newsletter_subscribers
  FOR INSERT WITH CHECK (true);
