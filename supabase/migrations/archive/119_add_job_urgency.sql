-- Add urgency column to ow_jobs for recruitment priority signaling
ALTER TABLE ow_jobs
ADD COLUMN IF NOT EXISTS urgency text NOT NULL DEFAULT 'open'
  CONSTRAINT ow_jobs_urgency_check CHECK (urgency IN ('open', 'hot'));

COMMENT ON COLUMN ow_jobs.urgency IS '採用温度感: open=通常募集, hot=積極採用中。HOTはOPINIO求職者側に強調表示される';
