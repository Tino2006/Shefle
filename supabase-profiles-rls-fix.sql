-- Run in Supabase SQL Editor if app-side profile inserts fail with RLS / permission errors.
-- Ensures authenticated users can INSERT their own row in public.profiles.

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- anon should not insert profiles; authenticated only
