-- Portfolio Trademarks Feature
-- Users can register their own trademarks and use them for monitoring

-- =====================================================
-- PORTFOLIO TRADEMARKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.portfolio_trademarks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registration_number TEXT NOT NULL,
  country TEXT NOT NULL,
  niche_class INTEGER NOT NULL CHECK (niche_class >= 1 AND niche_class <= 45),
  registration_date DATE NOT NULL,
  logo_url TEXT,
  mark_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_trademarks_user_id
  ON public.portfolio_trademarks(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_trademarks_user_reg
  ON public.portfolio_trademarks(user_id, registration_number);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.portfolio_trademarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own portfolio trademarks"
  ON public.portfolio_trademarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own portfolio trademarks"
  ON public.portfolio_trademarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own portfolio trademarks"
  ON public.portfolio_trademarks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portfolio trademarks"
  ON public.portfolio_trademarks FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================

DROP TRIGGER IF EXISTS update_portfolio_trademarks_updated_at ON public.portfolio_trademarks;
CREATE TRIGGER update_portfolio_trademarks_updated_at
  BEFORE UPDATE ON public.portfolio_trademarks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- LINK WATCHLISTS TO PORTFOLIO TRADEMARKS
-- =====================================================

ALTER TABLE public.watchlists
  ADD COLUMN IF NOT EXISTS portfolio_trademark_id BIGINT
  REFERENCES public.portfolio_trademarks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_watchlists_portfolio_trademark_id
  ON public.watchlists(portfolio_trademark_id)
  WHERE portfolio_trademark_id IS NOT NULL;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.portfolio_trademarks IS 'User-owned trademarks that can be monitored';
COMMENT ON COLUMN public.portfolio_trademarks.registration_number IS 'Official trademark registration number';
COMMENT ON COLUMN public.portfolio_trademarks.country IS 'Country of trademark registration';
COMMENT ON COLUMN public.portfolio_trademarks.niche_class IS 'Niche class (1-45)';
COMMENT ON COLUMN public.portfolio_trademarks.registration_date IS 'Date the trademark was registered';
COMMENT ON COLUMN public.portfolio_trademarks.logo_url IS 'URL to the trademark logo in Supabase Storage';
COMMENT ON COLUMN public.portfolio_trademarks.mark_name IS 'Optional display name for the trademark';
COMMENT ON COLUMN public.watchlists.portfolio_trademark_id IS 'FK to the portfolio trademark being monitored';
