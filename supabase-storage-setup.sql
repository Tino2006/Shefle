-- =====================================================
-- STORAGE BUCKETS SETUP
-- Run this in Supabase SQL Editor to create storage buckets
-- =====================================================

-- Create brand-files bucket (for POA, logos, business licenses)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-files',
  'brand-files',
  false,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create contact-attachments bucket (for contact form files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contact-attachments',
  'contact-attachments',
  true, -- Public bucket so attachments can be viewed
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STORAGE POLICIES
-- =====================================================

-- Policies for brand-files bucket
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

CREATE POLICY "Admins can view all brand files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'brand-files'
  -- Add your admin check here if needed
);

-- Policies for contact-attachments bucket
CREATE POLICY "Anyone can upload contact attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contact-attachments');

CREATE POLICY "Anyone can view contact attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'contact-attachments');

-- Note: The policies might fail if they already exist. That's OK!
-- The important part is creating the buckets.
