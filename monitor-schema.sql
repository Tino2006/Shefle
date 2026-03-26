-- Monitor Feature - Watchlists and Alerts
-- Add this to your existing database schema

-- =====================================================
-- WATCHLISTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.watchlists (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  min_similarity NUMERIC(3,2) NOT NULL DEFAULT 0.60 CHECK (min_similarity >= 0.0 AND min_similarity <= 1.0),
  status_filter TEXT NOT NULL DEFAULT 'ACTIVE,PENDING',
  class_filter INTEGER[] DEFAULT NULL,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_watchlists_user_id 
  ON public.watchlists(user_id);

-- Index for checking last checked time
CREATE INDEX IF NOT EXISTS idx_watchlists_last_checked 
  ON public.watchlists(last_checked_at) WHERE last_checked_at IS NOT NULL;

-- =====================================================
-- WATCHLIST HITS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.watchlist_hits (
  id BIGSERIAL PRIMARY KEY,
  watchlist_id BIGINT NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  trademark_id BIGINT NOT NULL REFERENCES public.trademarks(id) ON DELETE CASCADE,
  trademark_serial_number TEXT NOT NULL,
  similarity_score NUMERIC(5,3) NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW', 'VERY_LOW')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(watchlist_id, trademark_id)
);

-- Index for watchlist queries
CREATE INDEX IF NOT EXISTS idx_watchlist_hits_watchlist_id 
  ON public.watchlist_hits(watchlist_id);

-- Index for trademark lookups
CREATE INDEX IF NOT EXISTS idx_watchlist_hits_trademark_id 
  ON public.watchlist_hits(trademark_id);

-- Index for recent alerts queries (sorted by newest first)
CREATE INDEX IF NOT EXISTS idx_watchlist_hits_first_seen 
  ON public.watchlist_hits(first_seen_at DESC);

-- Composite index for user's recent alerts
CREATE INDEX IF NOT EXISTS idx_watchlist_hits_watchlist_first_seen 
  ON public.watchlist_hits(watchlist_id, first_seen_at DESC);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_hits ENABLE ROW LEVEL SECURITY;

-- Users can only see their own watchlists
CREATE POLICY "Users can view their own watchlists" 
  ON public.watchlists FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own watchlists" 
  ON public.watchlists FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watchlists" 
  ON public.watchlists FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watchlists" 
  ON public.watchlists FOR DELETE 
  USING (auth.uid() = user_id);

-- Users can only see hits for their watchlists
CREATE POLICY "Users can view hits for their watchlists" 
  ON public.watchlist_hits FOR SELECT 
  USING (
    watchlist_id IN (
      SELECT id FROM public.watchlists WHERE user_id = auth.uid()
    )
  );

-- Service role can insert hits (done via API)
-- Regular users cannot directly insert/update/delete hits

-- =====================================================
-- HELPER FUNCTION - Update updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on watchlists
CREATE TRIGGER update_watchlists_updated_at 
  BEFORE UPDATE ON public.watchlists 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.watchlists IS 'User-created brand monitoring watchlists';
COMMENT ON TABLE public.watchlist_hits IS 'Trademark matches found for each watchlist';
COMMENT ON COLUMN public.watchlists.min_similarity IS 'Minimum similarity score threshold (0.0 to 1.0)';
COMMENT ON COLUMN public.watchlists.status_filter IS 'Comma-separated status values to monitor (e.g., "ACTIVE,PENDING")';
COMMENT ON COLUMN public.watchlists.class_filter IS 'Array of NICE class numbers to filter by (NULL = all classes)';
COMMENT ON COLUMN public.watchlist_hits.risk_level IS 'Calculated risk level based on similarity score';
