import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AreebaConfigError, loadAreebaConfig } from "@/lib/areeba/config";
import {
  areebaCheckoutScriptUrl,
  buildInitPayload,
  createAreebaSession,
} from "@/lib/areeba/client";

const initiateSchema = z.object({
  planSlug: z.enum(["starter", "growth", "enterprise"]),
  billingCycle: z.enum(["monthly", "yearly"]),
});

/**
 * Compute the amount the user should be charged for a given plan + billing cycle.
 * Source of truth is `subscription_plans.price` (monthly). Yearly applies a 30%
 * discount on the monthly rate, then × 12 — mirrors the math in the
 * subscriptions page UI but moves it server-side so the frontend cannot tamper.
 */
function computeAmount(
  planMonthlyPrice: number,
  billingCycle: "monthly" | "yearly",
): number {
  if (billingCycle === "yearly") {
    const yearlyMonthlyEquivalent = Math.round(planMonthlyPrice * 0.7);

    return yearlyMonthlyEquivalent * 12;
  }

  return planMonthlyPrice;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { planSlug, billingCycle } = initiateSchema.parse(body);

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Resolve plan server-side from DB. Match by name (case-insensitive).
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .ilike("name", planSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (planError) {
      return NextResponse.json(
        { error: "Failed to load plan" },
        { status: 500 },
      );
    }
    if (!plan) {
      return NextResponse.json(
        {
          error: `Plan "${planSlug}" not found. Run supabase-areeba-migration.sql to seed plans.`,
        },
        { status: 404 },
      );
    }

    const amount = computeAmount(Number(plan.price), billingCycle);
    const currency = (plan.currency as string | null)?.toUpperCase() || "USD";
    const transactionReference = randomUUID();

    // Load Areeba config first so a misconfigured environment fails before we
    // create a stranded transaction row.
    let config;

    try {
      config = loadAreebaConfig();
    } catch (err) {
      if (err instanceof AreebaConfigError) {
        return NextResponse.json(
          {
            error: "Areeba gateway endpoint not configured yet",
            code: err.code,
          },
          { status: 501 },
        );
      }
      throw err;
    }

    // Create transaction row via service role: status 'pending', provider 'areeba'.
    const admin = createAdminClient();
    const { error: insertError } = await admin.from("transactions").insert({
      user_id: user.id,
      amount,
      currency,
      status: "pending",
      provider: "areeba",
      transaction_reference: transactionReference,
      plan_id: plan.id,
      billing_cycle: billingCycle,
      raw_request: { planSlug, billingCycle, planId: plan.id },
    });

    if (insertError) {
      console.error(
        "[areeba/initiate] insert transaction failed:",
        insertError.message,
      );

      return NextResponse.json(
        { error: "Failed to create payment record" },
        { status: 500 },
      );
    }

    const payload = buildInitPayload(config, {
      transactionReference,
      amount,
      currency,
      description: `${plan.name} (${billingCycle})`,
    });

    try {
      const session = await createAreebaSession(config, payload);

      // Persist any provider-side ids returned by the session call.
      if (session.areebaOrderId) {
        await admin
          .from("transactions")
          .update({ areeba_order_id: session.areebaOrderId })
          .eq("transaction_reference", transactionReference);
      }

      return NextResponse.json({
        sessionId: session.sessionId,
        checkoutScriptUrl: areebaCheckoutScriptUrl(config),
        transactionReference,
      });
    } catch (err) {
      if (
        err instanceof AreebaConfigError &&
        err.code === "GATEWAY_NOT_CONFIGURED"
      ) {
        return NextResponse.json(
          {
            error: "Areeba gateway endpoint not configured yet",
            code: "GATEWAY_NOT_CONFIGURED",
            transactionReference,
          },
          { status: 501 },
        );
      }
      console.error("[areeba/initiate] session create failed:", err);
      // Don't leave the transaction in 'pending' if we know the session failed.
      await admin
        .from("transactions")
        .update({
          status: "failed",
          response_message:
            err instanceof Error ? err.message : "session_create_failed",
          processed_at: new Date().toISOString(),
        })
        .eq("transaction_reference", transactionReference);

      return NextResponse.json(
        { error: "Could not start payment session" },
        { status: 502 },
      );
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[areeba/initiate] unexpected error:", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
