-- Migration 114: Add cover_photo_url and avatar_url to ow_users
-- ow_users currently has avatar_color (CSS gradient) and cover_color (CSS gradient).
-- This adds actual image URL fields for user-uploaded photos.
--
-- cover_photo_url: background image shown on /u/[id] profile page (replaces cover_color when set)
-- avatar_url: profile photo shown as avatar (replaces avatar_color letter-gradient when set)

ALTER TABLE ow_users
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

COMMENT ON COLUMN ow_users.cover_photo_url IS 'Storage URL for user cover/header photo (ow-uploads bucket: users/covers/{userId})';
COMMENT ON COLUMN ow_users.avatar_url IS 'Storage URL for user avatar photo (ow-uploads bucket: users/avatars/{userId})';
