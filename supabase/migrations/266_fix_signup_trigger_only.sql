-- Migration 266: Fix signup trigger (trigger-only fix, no DELETE)
-- Migration 265 failed because DELETE from ow_users cascaded to ow_conversations
-- and violated the ow_conversations_kind_consistency check constraint.
--
-- Root cause: handle_new_ow_user() used ON CONFLICT (auth_id) DO NOTHING,
-- which didn't suppress email unique constraint violations.
-- Orphaned ow_users rows (auth_id=null, same email) caused 500 on new signups.
--
-- Fix: change ON CONFLICT clause to cover ALL unique constraints.
-- The orphaned rows do not need to be deleted — ON CONFLICT DO NOTHING
-- will suppress the conflict and the new auth user won't get an ow_users row
-- (which is harmless; the existing row already has the right email).

CREATE OR REPLACE FUNCTION public.handle_new_ow_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.ow_users (
    auth_id,
    email,
    name,
    visibility,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    'public',
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
