-- Migration 229: Scout reply flow
-- Adds conversation_id + replied_at to ow_scouts,
-- and adds status CHECK constraint for the 4 valid states.

ALTER TABLE ow_scouts
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES ow_conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- Add status constraint (safe: existing rows all have status='sent')
ALTER TABLE ow_scouts
  DROP CONSTRAINT IF EXISTS ow_scouts_status_check;
ALTER TABLE ow_scouts
  ADD CONSTRAINT ow_scouts_status_check
    CHECK (status IN ('sent', 'read', 'interested', 'declined'));

CREATE INDEX IF NOT EXISTS idx_ow_scouts_conversation_id
  ON ow_scouts(conversation_id) WHERE conversation_id IS NOT NULL;
