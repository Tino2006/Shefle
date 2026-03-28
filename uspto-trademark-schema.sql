-- USPTO Trademark Search Engine - Database Schema
-- Run this migration in your Supabase SQL Editor or via psql
-- Step 1: Schema setup (no data import yet)

-- =====================================================
-- ENABLE EXTENSIONS
-- =====================================================

-- Enable pg_trgm for trigram similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- TRADEMARKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.trademarks (
  id BIGSERIAL PRIMARY KEY,
  office TEXT NOT NULL DEFAULT 'USPTO',
  serial_number TEXT NOT NULL,
  registration_number TEXT,
  mark_text TEXT,
  status_raw TEXT,
  status_norm TEXT CHECK (status_norm IN ('ACTIVE', 'PENDING', 'DEAD', NULL)),
  filing_date DATE,
  registration_date DATE,
  owner_name TEXT,
  owner_country TEXT,
  goods_services_text TEXT,
  source_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on office + serial_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_trademarks_office_serial 
  ON public.trademarks(office, serial_number);

-- Add generated tsvector column for full-text search
ALTER TABLE public.trademarks 
  ADD COLUMN IF NOT EXISTS mark_text_tsv TSVECTOR 
  GENERATED ALWAYS AS (to_tsvector('simple', COALESCE(mark_text, ''))) STORED;

-- GIN index on tsvector for full-text search
CREATE INDEX IF NOT EXISTS idx_trademarks_mark_text_tsv 
  ON public.trademarks USING GIN(mark_text_tsv);

-- GIN trigram index on mark_text for fuzzy similarity search
CREATE INDEX IF NOT EXISTS idx_trademarks_mark_text_trgm 
  ON public.trademarks USING GIN(mark_text gin_trgm_ops);

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_trademarks_status_norm 
  ON public.trademarks(status_norm) WHERE status_norm IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trademarks_filing_date 
  ON public.trademarks(filing_date) WHERE filing_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trademarks_registration_date 
  ON public.trademarks(registration_date) WHERE registration_date IS NOT NULL;

-- =====================================================
-- TRADEMARK CLASSES TABLE (NICE Classification)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.trademark_classes (
  trademark_id BIGINT NOT NULL REFERENCES public.trademarks(id) ON DELETE CASCADE,
  nice_class INTEGER NOT NULL CHECK (nice_class >= 1 AND nice_class <= 45),
  PRIMARY KEY (trademark_id, nice_class)
);

-- Index for class-based queries
CREATE INDEX IF NOT EXISTS idx_trademark_classes_nice_class 
  ON public.trademark_classes(nice_class);

-- =====================================================
-- IMPORT RUNS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.import_runs (
  id BIGSERIAL PRIMARY KEY,
  office TEXT NOT NULL,
  source_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  processed_rows BIGINT NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for tracking import history
CREATE INDEX IF NOT EXISTS idx_import_runs_office_status 
  ON public.import_runs(office, status);

CREATE INDEX IF NOT EXISTS idx_import_runs_created_at 
  ON public.import_runs(created_at DESC);

-- =====================================================
-- RLS POLICIES (Optional - configure based on access requirements)
-- =====================================================

-- For now, we'll enable RLS but allow public read access
-- Adjust these policies based on your application's security requirements

ALTER TABLE public.trademarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trademark_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to trademarks (for search)
-- Note: You may want to restrict this to authenticated users only
CREATE POLICY "Allow public read access to trademarks" 
  ON public.trademarks FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to trademark classes" 
  ON public.trademark_classes FOR SELECT 
  USING (true);

-- Only authenticated users can view import runs
CREATE POLICY "Authenticated users can view import runs" 
  ON public.import_runs FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- Only service role can insert/update trademarks and import data
-- (These operations will be done via backend API with service role key)

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate trademark similarity score
CREATE OR REPLACE FUNCTION calculate_trademark_similarity(
  query_text TEXT,
  mark_text TEXT
)
RETURNS FLOAT AS $$
BEGIN
  IF query_text IS NULL OR mark_text IS NULL THEN
    RETURN 0.0;
  END IF;
  
  -- Use trigram similarity
  RETURN similarity(query_text, mark_text);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to search trademarks with ranking
CREATE OR REPLACE FUNCTION search_trademarks(
  p_query TEXT,
  p_limit INTEGER DEFAULT 25,
  p_status TEXT DEFAULT NULL,
  p_classes INTEGER[] DEFAULT NULL
)
RETURNS TABLE(
  id BIGINT,
  office TEXT,
  serial_number TEXT,
  registration_number TEXT,
  mark_text TEXT,
  status_norm TEXT,
  filing_date DATE,
  registration_date DATE,
  owner_name TEXT,
  similarity_score FLOAT,
  rank FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.office,
    t.serial_number,
    t.registration_number,
    t.mark_text,
    t.status_norm,
    t.filing_date,
    t.registration_date,
    t.owner_name,
    similarity(LOWER(p_query), LOWER(t.mark_text)) AS similarity_score,
    -- Ranking formula: boost exact matches, use trigram similarity + full-text rank
    (
      CASE 
        WHEN LOWER(t.mark_text) = LOWER(p_query) THEN 10.0
        WHEN LOWER(t.mark_text) LIKE LOWER(p_query) || '%' THEN 5.0
        ELSE 0.0
      END
      + similarity(LOWER(p_query), LOWER(t.mark_text)) * 2.0
      + ts_rank(t.mark_text_tsv, plainto_tsquery('simple', p_query))
    ) AS rank
  FROM public.trademarks t
  LEFT JOIN public.trademark_classes tc ON t.id = tc.trademark_id
  WHERE 
    -- Text search conditions
    (
      t.mark_text_tsv @@ plainto_tsquery('simple', p_query)
      OR similarity(LOWER(p_query), LOWER(t.mark_text)) > 0.3
      OR LOWER(t.mark_text) LIKE '%' || LOWER(p_query) || '%'
    )
    -- Status filter
    AND (p_status IS NULL OR t.status_norm = p_status)
    -- Class filter (if specified)
    AND (p_classes IS NULL OR tc.nice_class = ANY(p_classes))
  GROUP BY t.id
  ORDER BY rank DESC, similarity_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE public.trademarks IS 'USPTO trademark records with full-text and trigram search capabilities';
COMMENT ON TABLE public.trademark_classes IS 'NICE classification codes for trademarks (many-to-many relationship)';
COMMENT ON TABLE public.import_runs IS 'Tracks bulk data import operations from USPTO';
COMMENT ON COLUMN public.trademarks.mark_text_tsv IS 'Generated tsvector column for full-text search';
COMMENT ON COLUMN public.trademarks.status_norm IS 'Normalized status: ACTIVE, PENDING, or DEAD';
COMMENT ON FUNCTION search_trademarks IS 'Main search function combining exact match, trigram similarity, and full-text search';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify extensions
-- SELECT * FROM pg_extension WHERE extname = 'pg_trgm';

-- Verify tables
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%trademark%';

-- Verify indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename LIKE '%trademark%';
