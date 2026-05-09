-- Prevent users from promoting themselves to admin via direct UPDATE.
--
-- Background: the existing "Users can update own profile" RLS policy is
-- column-agnostic, so an authenticated user could call
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)
-- from the browser and become an admin. This migration adds a BEFORE UPDATE
-- trigger that blocks role changes unless the caller is already an admin or
-- the service_role.
--
-- Apply via Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.is_admin()
     AND auth.role() <> 'service_role'
  THEN
    RAISE EXCEPTION 'role can only be changed by an admin or the service role';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_profile_role ON public.profiles;
CREATE TRIGGER protect_profile_role
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- Verification: as a non-admin authenticated user, this should raise.
--   UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid();
