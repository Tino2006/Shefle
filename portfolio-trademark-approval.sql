-- Portfolio trademark admin approval
-- Run after portfolio-schema.sql and supabase-rbac-migration.sql (requires public.is_admin()).
-- Same block is appended to portfolio-schema.sql; use either this file or the combined schema.

-- =====================================================
-- APPROVAL COLUMNS
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

-- =====================================================
-- PREVENT ROW OWNERS FROM CHANGING APPROVAL VIA SUPABASE CLIENT
-- (Server-side updates use a DB role with no auth.uid(); those are allowed.)
-- =====================================================

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

-- =====================================================
-- RLS: ADMINS CAN READ / UPDATE ALL
-- =====================================================

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
