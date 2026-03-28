-- Add owner/applicant country to trademark records.
-- Run this once on existing databases.

ALTER TABLE public.trademarks
  ADD COLUMN IF NOT EXISTS owner_country TEXT;
