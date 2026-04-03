ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS passport_file_url TEXT;
