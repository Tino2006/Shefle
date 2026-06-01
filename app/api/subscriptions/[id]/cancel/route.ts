import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/subscriptions/[id]/cancel
 *
 * Marks the subscription for cancellation at the end of the current billing
 * period (industry-standard "soft cancel"). The user keeps access until
 * `current_period_end`. No external provider call is made — Areeba runs a
 * one-time charge per period (no auto-renewal to revoke) and Stripe rows
 * would need their own portal redirect, which is out of scope here.
 *
 * Requires the caller to own the subscription row.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { error: "Missing subscription id" },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Ownership check + must be active.
    const { data: existing, error: lookupError } = await supabase
      .from("subscriptions")
      .select("id, user_id, status, cancel_at_period_end, current_period_end")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: lookupError.message },
        { status: 400 },
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 },
      );
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (existing.status !== "active") {
      return NextResponse.json(
        {
          error: "Subscription is not active",
          status: existing.status,
        },
        { status: 409 },
      );
    }

    if (existing.cancel_at_period_end) {
      // Idempotent — already scheduled to cancel.
      return NextResponse.json({
        success: true,
        subscription: existing,
        message: "Cancellation already scheduled.",
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      subscription: updated,
      message: `Cancellation scheduled. You'll keep access until ${updated.current_period_end}.`,
    });
  } catch (error) {
    console.error("[subscriptions/cancel] error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
