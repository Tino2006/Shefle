-- Shefle Backend Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE (extends Supabase auth.users)
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  phone TEXT,
  country TEXT,
  notification_preferences JSONB DEFAULT '{"email": true, "sms": false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- SUBSCRIPTION PLANS TABLE
-- =====================================================
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  searches_limit INTEGER,
  monitors_limit INTEGER,
  notifications_limit INTEGER,
  stripe_price_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO public.subscription_plans (name, price, searches_limit, monitors_limit, notifications_limit) VALUES
  ('Basic', 40.00, 50, 1, 20),
  ('Pro', 50.00, 70, 2, 40),
  ('Premium', 60.00, NULL, 3, NULL); -- NULL means unlimited

-- RLS Policies for subscription_plans
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" 
  ON public.subscription_plans FOR SELECT 
  USING (is_active = true);

-- =====================================================
-- USER SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) NOT NULL,
  status TEXT CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')) DEFAULT 'active',
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" 
  ON public.subscriptions FOR SELECT 
  USING (auth.uid() = user_id);

-- =====================================================
-- USAGE TRACKING TABLE
-- =====================================================
CREATE TABLE public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  searches_used INTEGER DEFAULT 0,
  monitors_used INTEGER DEFAULT 0,
  notifications_sent INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ DEFAULT NOW(),
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for usage_tracking
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" 
  ON public.usage_tracking FOR SELECT 
  USING (auth.uid() = user_id);

-- =====================================================
-- BRANDS/REGISTRATIONS TABLE
-- =====================================================
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  registration_type TEXT CHECK (registration_type IN ('individual', 'company')) NOT NULL,
  
  -- Personal/Company Info
  name TEXT,
  company_name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  
  -- Address
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  street_address TEXT,
  building_number TEXT,
  
  -- Registration Details
  registration_country TEXT NOT NULL,
  type_of_work TEXT,
  
  -- File URLs (stored in Supabase Storage)
  poa_file_url TEXT NOT NULL,
  logo_file_url TEXT NOT NULL,
  business_license_url TEXT,
  
  -- Status
  status TEXT CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')) DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for brands
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brands" 
  ON public.brands FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own brands" 
  ON public.brands FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brands" 
  ON public.brands FOR UPDATE 
  USING (auth.uid() = user_id);

-- =====================================================
-- TRANSACTIONS/PAYMENTS TABLE
-- =====================================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')) DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  payment_method_last4 TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" 
  ON public.transactions FOR SELECT 
  USING (auth.uid() = user_id);

-- =====================================================
-- CONTACT SUBMISSIONS TABLE
-- =====================================================
CREATE TABLE public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  file_url TEXT,
  status TEXT CHECK (status IN ('new', 'read', 'replied', 'archived')) DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for contact_submissions (admin only)
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact form" 
  ON public.contact_submissions FOR INSERT 
  WITH CHECK (true);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- INDEXES for better performance
-- =====================================================
CREATE INDEX idx_profiles_user_id ON public.profiles(id);
CREATE INDEX idx_brands_user_id ON public.brands(user_id);
CREATE INDEX idx_brands_status ON public.brands(status);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_usage_tracking_user_id ON public.usage_tracking(user_id);

-- =====================================================
-- STORAGE BUCKETS (Create these in Supabase Storage UI or via SQL)
-- =====================================================
-- You'll need to create these buckets in Supabase Dashboard -> Storage:
-- 1. 'brand-files' - for POA, logos, business licenses
-- 2. 'contact-attachments' - for contact form files
-- 
-- Or run these commands:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('brand-files', 'brand-files', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('contact-attachments', 'contact-attachments', false);

-- Storage policies for brand-files bucket
CREATE POLICY "Users can upload own brand files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'brand-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own brand files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'brand-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for contact-attachments bucket
CREATE POLICY "Anyone can upload contact attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contact-attachments');

CREATE POLICY "Admins can view contact attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'contact-attachments');
