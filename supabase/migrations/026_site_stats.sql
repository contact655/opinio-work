-- Fix 8: Site stats for the homepage badge section
CREATE TABLE IF NOT EXISTS ow_site_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value integer NOT NULL,
  unit text,
  label text NOT NULL,
  emoji text,
  note text,
  display_order integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO ow_site_stats (key, value, unit, label, emoji, note, display_order) VALUES
  ('interviewed_companies', 120, '社+', '取材実績', '📊', NULL, 1),
  ('early_turnover', 0, '件', '創業以来の早期離職', '🎯', '※2023年9月の創業以降、2026年4月現在まで200名以上の転職支援実績', 2),
  ('support_count', 200, '名+', '相談・転職支援実績', '👥', NULL, 3),
  ('approved_companies', 25, '社', '審査通過企業', '🌟', NULL, 4)
ON CONFLICT (key) DO NOTHING;

-- Public read
ALTER TABLE ow_site_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can read site stats" ON ow_site_stats;
CREATE POLICY "anyone can read site stats" ON ow_site_stats
  FOR SELECT USING (true);
