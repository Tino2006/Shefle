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
  niche_classes INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  registration_date DATE NOT NULL,
  logo_url TEXT,
  mark_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support multi-class trademarks while keeping backward compatibility with niche_class.
ALTER TABLE public.portfolio_trademarks
  ADD COLUMN IF NOT EXISTS niche_classes INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

ALTER TABLE public.portfolio_trademarks
  DROP CONSTRAINT IF EXISTS portfolio_trademarks_niche_classes_valid;

ALTER TABLE public.portfolio_trademarks
  ADD CONSTRAINT portfolio_trademarks_niche_classes_valid
  CHECK (
    array_length(niche_classes, 1) >= 1
    AND niche_class = niche_classes[1]
    AND niche_classes <@ ARRAY[
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
      31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
      41, 42, 43, 44, 45
    ]::INTEGER[]
  );

UPDATE public.portfolio_trademarks
SET niche_classes = ARRAY[niche_class]
WHERE niche_classes IS NULL OR array_length(niche_classes, 1) IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_trademarks_user_id
  ON public.portfolio_trademarks(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_trademarks_user_reg
  ON public.portfolio_trademarks(user_id, registration_number);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.portfolio_trademarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own portfolio trademarks" ON public.portfolio_trademarks;
CREATE POLICY "Users can view their own portfolio trademarks"
  ON public.portfolio_trademarks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own portfolio trademarks" ON public.portfolio_trademarks;
CREATE POLICY "Users can insert their own portfolio trademarks"
  ON public.portfolio_trademarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own portfolio trademarks" ON public.portfolio_trademarks;
CREATE POLICY "Users can update their own portfolio trademarks"
  ON public.portfolio_trademarks FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own portfolio trademarks" ON public.portfolio_trademarks;
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
COMMENT ON COLUMN public.portfolio_trademarks.niche_classes IS 'One or more niche classes (1-45), first value mirrors niche_class';
COMMENT ON COLUMN public.portfolio_trademarks.registration_date IS 'Date the trademark was registered';
COMMENT ON COLUMN public.portfolio_trademarks.logo_url IS 'URL to the trademark logo in Supabase Storage';
COMMENT ON COLUMN public.portfolio_trademarks.mark_name IS 'Display name for the trademark';
COMMENT ON COLUMN public.watchlists.portfolio_trademark_id IS 'FK to the portfolio trademark being monitored';

-- =====================================================
-- ADMIN APPROVAL (requires public.is_admin() from supabase-rbac-migration.sql)
-- Idempotent: safe to re-run. Standalone copy: portfolio-trademark-approval.sql
-- =====================================================

ALTER TABLE public.portfolio_trademarks
  ADD COLUMN IF NOT EXISTS approval_status TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.portfolio_trademarks
SET approval_status = 'approved'
WHERE approval_status IS NULL;

ALTER TABLE public.portfolio_trademarks
  ALTER COLUMN approval_status SET NOT NULL,
  ALTER COLUMN approval_status SET DEFAULT 'pending';

ALTER TABLE public.portfolio_trademarks
  DROP CONSTRAINT IF EXISTS portfolio_trademarks_approval_status_check;

ALTER TABLE public.portfolio_trademarks
  ADD CONSTRAINT portfolio_trademarks_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_portfolio_trademarks_approval_status
  ON public.portfolio_trademarks(approval_status);

CREATE OR REPLACE FUNCTION public.portfolio_trademarks_approval_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (
      NEW.approval_status IS DISTINCT FROM OLD.approval_status
      OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
    ) THEN
      IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can change approval fields';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL AND auth.uid() = NEW.user_id AND NOT public.is_admin() THEN
    NEW.approval_status := 'pending';
    NEW.rejection_reason := NULL;
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portfolio_trademarks_approval_guard ON public.portfolio_trademarks;
CREATE TRIGGER portfolio_trademarks_approval_guard
  BEFORE INSERT OR UPDATE ON public.portfolio_trademarks
  FOR EACH ROW
  EXECUTE FUNCTION public.portfolio_trademarks_approval_guard();

DROP POLICY IF EXISTS "Users can view their own portfolio trademarks" ON public.portfolio_trademarks;
CREATE POLICY "Users can view own portfolio, admins view all"
  ON public.portfolio_trademarks FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert their own portfolio trademarks" ON public.portfolio_trademarks;
CREATE POLICY "Users can insert their own portfolio trademarks"
  ON public.portfolio_trademarks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (public.is_admin() OR COALESCE(approval_status, 'pending') = 'pending')
  );

DROP POLICY IF EXISTS "Users can update their own portfolio trademarks" ON public.portfolio_trademarks;
CREATE POLICY "Users can update own portfolio, admins update all"
  ON public.portfolio_trademarks FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can delete their own portfolio trademarks" ON public.portfolio_trademarks;
CREATE POLICY "Users can delete own portfolio, admins delete all"
  ON public.portfolio_trademarks FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

COMMENT ON COLUMN public.portfolio_trademarks.approval_status IS 'pending until admin approves; only approved marks can be used for new monitors';
COMMENT ON COLUMN public.portfolio_trademarks.rejection_reason IS 'Shown to the user when status is rejected';
