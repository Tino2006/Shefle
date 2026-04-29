-- Areeba payment provider — extends the existing transactions table.
-- Apply via Supabase SQL Editor. Idempotent.

-- =====================================================
-- 1. Provider + Areeba-specific columns (all nullable to preserve existing Stripe rows)
-- =====================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT,
  ADD COLUMN IF NOT EXISTS areeba_order_id TEXT,
  ADD COLUMN IF NOT EXISTS areeba_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS response_code TEXT,
  ADD COLUMN IF NOT EXISTS response_message TEXT,
  ADD COLUMN IF NOT EXISTS authorization_code TEXT,
  ADD COLUMN IF NOT EXISTS raw_request JSONB,
  ADD COLUMN IF NOT EXISTS raw_response JSONB,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Provider whitelist
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_provider_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_provider_check
  CHECK (provider IN ('stripe','areeba'));

-- Billing cycle whitelist (NULL allowed for legacy/Stripe rows)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_billing_cycle_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_billing_cycle_check
  CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly','yearly'));

-- =====================================================
-- 2. Status enum extension — add pending_verification, cancelled
-- =====================================================
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (status IN (
    'pending',
    'pending_verification',
    'succeeded',
    'failed',
    'refunded',
    'cancelled'
  ));

-- =====================================================
-- 3. Idempotency: at most one transaction per reference
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS transactions_transaction_reference_key
  ON public.transactions (transaction_reference)
  WHERE transaction_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_provider_status
  ON public.transactions (provider, status);

-- =====================================================
-- 4. updated_at auto-touch (mirrors profiles/subscriptions/brands)
-- =====================================================
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. Seed subscription_plans rows the frontend currently hardcodes
--    (insert-if-missing; existing rows untouched). Keeps initiate API
--    able to resolve Starter/Growth/Enterprise slugs without a separate
--    admin step. subscription_plans has no UNIQUE on name, so we use
--    NOT EXISTS instead of ON CONFLICT.
-- =====================================================
INSERT INTO public.subscription_plans (name, price, currency, searches_limit, monitors_limit, notifications_limit, is_active)
SELECT 'Starter', 100, 'USD', 50, 1, 20, true
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE LOWER(name) = 'starter');

INSERT INTO public.subscription_plans (name, price, currency, searches_limit, monitors_limit, notifications_limit, is_active)
SELECT 'Growth', 150, 'USD', 70, 2, 40, true
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE LOWER(name) = 'growth');

INSERT INTO public.subscription_plans (name, price, currency, searches_limit, monitors_limit, notifications_limit, is_active)
SELECT 'Enterprise', 200, 'USD', NULL, 3, NULL, true
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE LOWER(name) = 'enterprise');
