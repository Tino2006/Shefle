-- Referral tracking (MVP) — run in Supabase SQL Editor after prior migrations.
-- Extends public.profiles (1:1 with auth.users).
-- Prerequisite: public.profiles.role exists (see supabase-rbac-migration.sql).

-- =====================================================
-- 1. COLUMNS
-- =====================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- =====================================================
-- 2. GENERATE UNIQUE REFERRAL CODE (6–8 chars, A–Z + 2–9, excludes 0/O/1/I)
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS TEXT AS $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT;
  len INT;
  i INT;
  pos INT;
BEGIN
  LOOP
    len := 6 + floor(random() * 3)::INT;
    result := '';
    FOR i IN 1..len LOOP
      pos := 1 + floor(random() * length(alphabet))::INT;
      result := result || substr(alphabet, pos, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = result);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing rows before NOT NULL / UNIQUE
UPDATE public.profiles
SET referral_code = public.generate_unique_referral_code()
WHERE referral_code IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN referral_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_user_id ON public.profiles (referred_by_user_id);

-- =====================================================
-- 3. NEW USER: code + optional referrer from raw_user_meta_data.referral_code
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  ref_input TEXT;
  referrer_id UUID;
BEGIN
  new_code := public.generate_unique_referral_code();
  ref_input := upper(trim(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')));

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

  INSERT INTO public.profiles (id, first_name, last_name, role, referral_code, referred_by_user_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    new_code,
    referrer_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. IMMUTABLE referral fields
--    - referral_code: never change after insert
--    - referred_by_user_id: set at signup (insert) or once via service_role backfill; users cannot change
-- =====================================================
CREATE OR REPLACE FUNCTION public.profiles_referral_immutable()
RETURNS TRIGGER AS $$
DECLARE
  jwt_role TEXT;
BEGIN
  jwt_role := COALESCE(current_setting('request.jwt.claim.role', true), '');

  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    NEW.referral_code := OLD.referral_code;
  END IF;

  IF NEW.referred_by_user_id IS DISTINCT FROM OLD.referred_by_user_id THEN
    IF OLD.referred_by_user_id IS NOT NULL THEN
      NEW.referred_by_user_id := OLD.referred_by_user_id;
    ELSIF jwt_role IS DISTINCT FROM 'service_role' THEN
      NEW.referred_by_user_id := OLD.referred_by_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_referral_immutable_trigger ON public.profiles;
CREATE TRIGGER profiles_referral_immutable_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_referral_immutable();

-- =====================================================
-- 5. RLS: referrers can see basic info on referred profiles
-- =====================================================
DROP POLICY IF EXISTS "Users can view profiles they referred" ON public.profiles;
CREATE POLICY "Users can view profiles they referred"
  ON public.profiles FOR SELECT
  USING (referred_by_user_id = auth.uid());
