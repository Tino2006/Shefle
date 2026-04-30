-- Migration: drop POA upload from brands, add "trademark is colored" flag.
-- Apply via Supabase SQL Editor.

ALTER TABLE brands DROP COLUMN IF EXISTS poa_file_url;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS is_colored BOOLEAN NOT NULL DEFAULT FALSE;
