-- Fix: Google OAuth users had NULL first_name / last_name in `profiles`
-- because the trigger only read raw_user_meta_data->>'first_name'/'last_name',
-- which Google's OIDC payload never populates. Google sets `given_name`,
-- `family_name`, `name`, and `full_name` instead.
--
-- This migration:
--   1. Updates handle_new_user() to read app fields, then OIDC fields, then
--      fall back to splitting `full_name`/`name`.
--   2. Backfills existing rows whose names are NULL but whose auth.users
--      raw_user_meta_data has them.
--
-- Apply via Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta JSONB;
  first_name_val TEXT;
  last_name_val TEXT;
  full_name_val TEXT;
  parts TEXT[];
  new_code TEXT;
  ref_input TEXT;
  referrer_id UUID;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  -- App fields take precedence; fall back to Google OIDC fields.
  first_name_val := NULLIF(TRIM(meta->>'first_name'), '');
  IF first_name_val IS NULL THEN
    first_name_val := NULLIF(TRIM(meta->>'given_name'), '');
  END IF;

  last_name_val := NULLIF(TRIM(meta->>'last_name'), '');
  IF last_name_val IS NULL THEN
    last_name_val := NULLIF(TRIM(meta->>'family_name'), '');
  END IF;

  -- If still missing, split a single full-name field.
  IF first_name_val IS NULL OR last_name_val IS NULL THEN
    full_name_val := COALESCE(
      NULLIF(TRIM(meta->>'full_name'), ''),
      NULLIF(TRIM(meta->>'name'), '')
    );
    IF full_name_val IS NOT NULL THEN
      parts := regexp_split_to_array(full_name_val, '\s+');
      IF first_name_val IS NULL THEN
        first_name_val := parts[1];
      END IF;
      IF last_name_val IS NULL AND array_length(parts, 1) > 1 THEN
        last_name_val := array_to_string(parts[2:array_length(parts, 1)], ' ');
      END IF;
    END IF;
  END IF;

  new_code := public.generate_unique_referral_code();
  ref_input := upper(trim(COALESCE(meta->>'referral_code', '')));

  referrer_id := NULL;
  IF ref_input <> '' THEN
    SELECT p.id INTO referrer_id
    FROM public.profiles AS p
    WHERE p.referral_code = ref_input
    LIMIT 1;

    IF referrer_id IS NOT NULL AND referrer_id = NEW.id THEN
      referrer_id := NULL;
    END IF;
  END IF;

  -- Role is hard-coded to 'user'. Promotion to 'admin' must be done explicitly
  -- (via service_role or by an existing admin) so signup metadata cannot self-promote.
  INSERT INTO public.profiles (id, first_name, last_name, role, referral_code, referred_by_user_id)
  VALUES (
    NEW.id,
    first_name_val,
    last_name_val,
    'user',
    new_code,
    referrer_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing OAuth users whose first_name / last_name are NULL.
UPDATE public.profiles p
SET
  first_name = COALESCE(
    p.first_name,
    NULLIF(TRIM(u.raw_user_meta_data->>'first_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'given_name'), ''),
    split_part(
      COALESCE(
        NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'name'), '')
      ),
      ' ',
      1
    )
  ),
  last_name = COALESCE(
    p.last_name,
    NULLIF(TRIM(u.raw_user_meta_data->>'last_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'family_name'), ''),
    NULLIF(
      regexp_replace(
        COALESCE(
          NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
          NULLIF(TRIM(u.raw_user_meta_data->>'name'), '')
        ),
        '^\S+\s*',
        ''
      ),
      ''
    )
  )
FROM auth.users u
WHERE u.id = p.id
  AND (p.first_name IS NULL OR p.last_name IS NULL);
