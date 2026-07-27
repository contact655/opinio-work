-- 求人とメンバーの中間テーブル
CREATE TABLE IF NOT EXISTS ow_job_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES ow_jobs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES ow_company_members(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(job_id, member_id)
);

ALTER TABLE ow_job_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read ow_job_members"
  ON ow_job_members FOR SELECT USING (true);

-- サンプルデータ投入：photo_urlがあるメンバーを同じ会社の全求人に自動紐付け
INSERT INTO ow_job_members (job_id, member_id, display_order)
SELECT
  j.id,
  m.id,
  ROW_NUMBER() OVER (PARTITION BY j.id ORDER BY m.display_order)
FROM ow_jobs j
JOIN ow_company_members m ON m.company_id = j.company_id
WHERE m.photo_url IS NOT NULL
ON CONFLICT DO NOTHING;
