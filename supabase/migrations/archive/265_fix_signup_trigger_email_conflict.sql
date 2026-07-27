-- Migration 265: Fix signup trigger to handle email unique constraint conflicts
-- Problem: handle_new_ow_user() only handled ON CONFLICT (auth_id), not email conflicts.
-- Orphaned ow_users rows (auth_id=null) with the same email caused 500 "Database error saving new user".

-- 1. Delete orphaned ow_users rows that have no corresponding auth user
DELETE FROM public.ow_users
WHERE auth_id IS NULL
  AND email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.email = ow_users.email
  );

-- 2. Update the trigger function to suppress ALL unique violations (both auth_id and email)
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
