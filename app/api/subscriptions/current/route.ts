import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { queryOne } from "@/lib/db/postgres";
import {
  getActiveSubscription,
  getCurrentUsage,
} from "@/lib/subscriptions/usage";

/**
 * GET /api/subscriptions/current
 *
 * Returns the caller's active subscription, the associated plan, and
 * current-period usage figures. For monitors specifically, "used" reflects
 * the live count of watchlists owned by the user — see
 * app/api/watchlists/route.ts for the same logic on the write side.
 *
 * Response shape:
 * {
 *   subscription: {
 *     id, status, current_period_start, current_period_end,
 *     cancel_at_period_end,
 *     plan: { id, name, price, currency,
 *             searches_limit, monitors_limit, notifications_limit }
 *   } | null,
 *   usage: {
 *     searches_used, monitors_used, notifications_sent,
 *     searches_remaining, monitors_remaining, notifications_remaining
 *     // *_remaining = null when limit is unlimited
 *   } | null
 * }
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const subscription = await getActiveSubscription(supabase, user.id);

    if (!subscription) {
      return NextResponse.json({ subscription: null, usage: null });
    }

    const usageRow = await getCurrentUsage(supabase, subscription);

    // Monitors are tracked live, not cumulatively.
    const monitorCountRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM public.watchlists WHERE user_id = $1`,
      [user.id],
    );
    const monitorsUsed = Number(monitorCountRow?.count ?? 0);

    const remaining = (used: number, limit: number | null) =>
      limit === null ? null : Math.max(0, limit - used);

    const searchesUsed = usageRow?.searches_used ?? 0;
    const notificationsSent = usageRow?.notifications_sent ?? 0;

    return NextResponse.json({
      subscription,
      usage: {
        searches_used: searchesUsed,
        monitors_used: monitorsUsed,
        notifications_sent: notificationsSent,
        searches_remaining: remaining(
          searchesUsed,
          subscription.plan.searches_limit,
        ),
        monitors_remaining: remaining(
          monitorsUsed,
          subscription.plan.monitors_limit,
        ),
        notifications_remaining: remaining(
          notificationsSent,
          subscription.plan.notifications_limit,
        ),
      },
    });
  } catch (error) {
    console.error("[subscriptions/current] error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
