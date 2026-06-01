import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Subscription usage helpers.
 *
 * Reads/writes the `usage_tracking` table (one row per (user, subscription,
 * period_start)) and surfaces "how much is left" against the active plan's
 * limits.
 *
 * NULL plan limits mean "unlimited" — `enforceQuota` returns ok in that case.
 *
 * We use the admin (service-role) client so increments succeed regardless of
 * the calling context (route handler vs cron) and aren't blocked by RLS.
 */

export type UsageField =
  | "searches_used"
  | "monitors_used"
  | "notifications_sent";

export type PlanLimits = {
  searches_limit: number | null;
  monitors_limit: number | null;
  notifications_limit: number | null;
};

export type ActiveSubscription = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan: {
    id: string;
    name: string;
    price: number | string;
    currency: string;
  } & PlanLimits;
};

export type UsageRow = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  searches_used: number;
  monitors_used: number;
  notifications_sent: number;
  period_start: string;
  period_end: string | null;
};

export type QuotaCheck = {
  allowed: boolean;
  remaining: number | null; // null = unlimited
  limit: number | null;
  used: number;
  reason?: "no_subscription" | "limit_reached";
};

/**
 * Look up the user's active subscription (with plan) using an arbitrary
 * Supabase client (typically the request-scoped server client so RLS still
 * applies for reads).
 */
export async function getActiveSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveSubscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      `
        id,
        user_id,
        plan_id,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        plan:subscription_plans(
          id,
          name,
          price,
          currency,
          searches_limit,
          monitors_limit,
          notifications_limit
        )
      `,
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Supabase types the joined relation as an array; flatten to a single object.
  const plan = Array.isArray((data as any).plan)
    ? (data as any).plan[0]
    : (data as any).plan;

  if (!plan) return null;

  return { ...(data as any), plan } as ActiveSubscription;
}

/**
 * Fetch the usage row for the current period, or null if it doesn't exist
 * yet (treated as zero-usage by callers).
 */
export async function getCurrentUsage(
  supabase: SupabaseClient,
  subscription: ActiveSubscription,
): Promise<UsageRow | null> {
  const { data, error } = await supabase
    .from("usage_tracking")
    .select("*")
    .eq("user_id", subscription.user_id)
    .eq("subscription_id", subscription.id)
    .eq("period_start", subscription.current_period_start)
    .maybeSingle();

  if (error) return null;

  return (data as UsageRow) ?? null;
}

/**
 * Increment a usage counter. Creates the row if it doesn't exist yet.
 *
 * Returns the new value, or null if no active subscription was found.
 * Soft-fails on internal errors (logs + returns null) so the caller can
 * still complete its primary action — usage tracking should never block UX
 * for a transient DB issue.
 */
export async function incrementUsage(
  userId: string,
  field: UsageField,
  amount = 1,
): Promise<number | null> {
  try {
    const admin = createAdminClient();
    const subscription = await getActiveSubscription(admin, userId);

    if (!subscription) return null;

    // Try update first
    const existing = await getCurrentUsage(admin, subscription);

    if (existing) {
      const next = (existing[field] ?? 0) + amount;
      const { error } = await admin
        .from("usage_tracking")
        .update({ [field]: next })
        .eq("id", existing.id);

      if (error) {
        console.error("[usage] update failed:", error.message);

        return null;
      }

      return next;
    }

    // Insert a fresh row for this period
    const { data, error } = await admin
      .from("usage_tracking")
      .insert({
        user_id: userId,
        subscription_id: subscription.id,
        period_start: subscription.current_period_start,
        period_end: subscription.current_period_end,
        searches_used: field === "searches_used" ? amount : 0,
        monitors_used: field === "monitors_used" ? amount : 0,
        notifications_sent: field === "notifications_sent" ? amount : 0,
      })
      .select(field)
      .single();

    if (error) {
      console.error("[usage] insert failed:", error.message);

      return null;
    }

    return (data as any)?.[field] ?? amount;
  } catch (err) {
    console.error("[usage] incrementUsage threw:", err);

    return null;
  }
}

/**
 * Pre-flight quota check. Use before performing a billable action.
 *
 * - No active subscription → `{ allowed: false, reason: 'no_subscription' }`
 *   (caller decides whether to allow a free tier, redirect, etc.)
 * - Limit is NULL → unlimited → `{ allowed: true, remaining: null }`
 * - Limit hit → `{ allowed: false, reason: 'limit_reached' }`
 */
export async function checkQuota(
  supabase: SupabaseClient,
  userId: string,
  field: UsageField,
  limitField: keyof PlanLimits,
): Promise<QuotaCheck> {
  const subscription = await getActiveSubscription(supabase, userId);

  if (!subscription) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      used: 0,
      reason: "no_subscription",
    };
  }

  const limit = subscription.plan[limitField];

  if (limit === null) {
    return { allowed: true, remaining: null, limit: null, used: 0 };
  }

  const usage = await getCurrentUsage(supabase, subscription);
  const used = (usage?.[field] as number | undefined) ?? 0;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    remaining,
    limit,
    used,
    reason: used >= limit ? "limit_reached" : undefined,
  };
}
