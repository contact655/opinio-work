-- Migration 246: add event columns to ow_posts (idempotent)
ALTER TABLE ow_posts
  ADD COLUMN IF NOT EXISTS event_title      TEXT,
  ADD COLUMN IF NOT EXISTS event_starts_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS event_location   TEXT;
