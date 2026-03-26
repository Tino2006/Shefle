-- Role-Based Access Control Migration
-- Run this in your Supabase SQL Editor

-- =====================================================
-- 1. ADD ROLE FIELD TO PROFILES
-- =====================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN role TEXT CHECK (role IN ('user', 'admin')) DEFAULT 'user' NOT NULL;
  END IF;
END $$;

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Update the handle_new_user function to include role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. CREATE HELPER FUNCTION TO CHECK IF USER IS ADMIN
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. UPDATE RLS POLICIES FOR BRANDS TABLE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can create own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can update own brands" ON public.brands;

-- Recreate policies with admin access
CREATE POLICY "Users can view own brands, admins can view all" 
  ON public.brands FOR SELECT 
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create own brands" 
  ON public.brands FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brands, admins can update all" 
  ON public.brands FOR UPDATE 
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can delete brands"
  ON public.brands FOR DELETE
  USING (public.is_admin());

-- =====================================================
-- 4. UPDATE RLS POLICIES FOR CONTACT SUBMISSIONS
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;

-- Recreate policies
CREATE POLICY "Anyone can submit contact form" 
  ON public.contact_submissions FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Admins can view all contact submissions"
  ON public.contact_submissions FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update contact submissions"
  ON public.contact_submissions FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete contact submissions"
  ON public.contact_submissions FOR DELETE
  USING (public.is_admin());

-- =====================================================
-- 5. UPDATE RLS POLICIES FOR SUBSCRIPTION PLANS
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;

-- Recreate policies
CREATE POLICY "Anyone can view active plans" 
  ON public.subscription_plans FOR SELECT 
  USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins can insert plans"
  ON public.subscription_plans FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update plans"
  ON public.subscription_plans FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete plans"
  ON public.subscription_plans FOR DELETE
  USING (public.is_admin());

-- =====================================================
-- 6. UPDATE RLS POLICIES FOR SUBSCRIPTIONS
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;

-- Recreate policies
CREATE POLICY "Users can view own subscriptions, admins can view all" 
  ON public.subscriptions FOR SELECT 
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete subscriptions"
  ON public.subscriptions FOR DELETE
  USING (public.is_admin());

-- =====================================================
-- 7. UPDATE RLS POLICIES FOR TRANSACTIONS
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;

-- Recreate policies
CREATE POLICY "Users can view own transactions, admins can view all" 
  ON public.transactions FOR SELECT 
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  USING (public.is_admin());

-- =====================================================
-- 8. UPDATE RLS POLICIES FOR USAGE TRACKING
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own usage" ON public.usage_tracking;

-- Recreate policies
CREATE POLICY "Users can view own usage, admins can view all" 
  ON public.usage_tracking FOR SELECT 
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can manage usage tracking"
  ON public.usage_tracking FOR ALL
  USING (public.is_admin());

-- =====================================================
-- 9. UPDATE STORAGE POLICIES
-- =====================================================

-- Brand files - admins can view all
DROP POLICY IF EXISTS "Admins can view all brand files" ON storage.objects;
CREATE POLICY "Admins can view all brand files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'brand-files' AND 
  (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin())
);

-- Contact attachments - already has admin policy
DROP POLICY IF EXISTS "Admins can view contact attachments" ON storage.objects;
CREATE POLICY "Admins can view contact attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'contact-attachments' AND public.is_admin());

-- =====================================================
-- 10. GRANT FIRST ADMIN (OPTIONAL)
-- =====================================================
-- Uncomment and replace with your email to make yourself an admin
-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Check if role column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'role';

-- View all profiles with roles
SELECT id, first_name, last_name, role, created_at FROM public.profiles;

-- Test is_admin function (run as authenticated user)
-- SELECT public.is_admin();
