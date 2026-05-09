import type { AreebaOrderResult } from "./types";

import { createAdminClient } from "@/lib/supabase/admin";
import { AreebaConfigError, loadAreebaConfig } from "./config";
import { getAreebaOrder } from "./client";

export type ReconcileOutcome =
  | "succeeded"
  | "failed"
  | "cancelled"
  | "pending"
  | "noop"
  | "not_found"
  | "error";

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

interface TransactionRow {
  id: string;
  user_id: string;
  amount: number | string;
  currency: string;
  status: string;
  provider: string;
  transaction_reference: string | null;
  plan_id: string | null;
  billing_cycle: "monthly" | "yearly" | null;
  subscription_id: string | null;
}

function classifyOrder(order: AreebaOrderResult): ReconcileOutcome {
  if (order.result === "NOT_FOUND") return "pending";
  if (order.result === "PENDING") return "pending";

  // MPGS: status is the authoritative outcome; fall back to `result` for ERROR.
  const status = (order.status ?? "").toUpperCase();
  if (status === "CAPTURED" || status === "AUTHORIZED") return "succeeded";
  if (status === "CANCELLED" || status === "EXPIRED") return "cancelled";
  if (status === "FAILED" || status === "DECLINED") return "failed";

  if (order.result === "SUCCESS") return "succeeded";
  if (order.result === "FAILURE") return "failed";
  if (order.result === "ERROR") return "failed";

  // Unknown shape — be conservative.
  return "pending";
}

/**
 * Idempotent. Looks up `transactions` by reference, calls Areeba GET order,
 * verifies amount/currency, transitions status. If the row is already in a
 * terminal state, returns 'noop' without touching anything.
 *
 * Used by:
 *   - POST /api/payments/[ref]/reconcile  (called from /payment/result on mount)
 *   - POST/GET /api/payments/areeba/callback (called from the demoted webhook)
 */
export async function reconcileTransaction(
  reference: string,
): Promise<ReconcileOutcome> {
  if (!reference) return "error";

  const admin = createAdminClient();

  const { data: tx, error: lookupError } = await admin
    .from("transactions")
    .select(
      "id, user_id, amount, currency, status, provider, transaction_reference, plan_id, billing_cycle, subscription_id",
    )
    .eq("transaction_reference", reference)
    .eq("provider", "areeba")
    .maybeSingle<TransactionRow>();

  if (lookupError) {
    console.error("[areeba/reconcile] lookup failed:", lookupError.message);
    return "error";
  }
  if (!tx) return "not_found";
  if (TERMINAL_STATUSES.has(tx.status)) return "noop";

  let config;
  try {
    config = loadAreebaConfig();
  } catch (err) {
    if (err instanceof AreebaConfigError) {
      console.warn(
        "[areeba/reconcile] gateway not configured; leaving row pending",
        { code: err.code },
      );
      return "pending";
    }
    throw err;
  }

  let order: AreebaOrderResult;
  try {
    order = await getAreebaOrder(config, reference);
  } catch (err) {
    console.error("[areeba/reconcile] GET order failed:", err);
    return "error";
  }

  // Amount + currency must match what we stored, regardless of order result.
  // We treat a mismatch as a hard failure even if Areeba says SUCCESS.
  if (order.amount != null) {
    const stored = Number(tx.amount);
    if (!Number.isFinite(order.amount) || Math.abs(order.amount - stored) > 0.01) {
      await admin
        .from("transactions")
        .update({
          status: "failed",
          response_message: "amount_currency_mismatch",
          raw_response: order.raw as Record<string, unknown> | null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", tx.id);
      console.warn("[areeba/reconcile] amount mismatch", {
        reference,
        stored,
        got: order.amount,
      });
      return "failed";
    }
  }
  if (
    order.currency &&
    order.currency.toUpperCase() !== String(tx.currency).toUpperCase()
  ) {
    await admin
      .from("transactions")
      .update({
        status: "failed",
        response_message: "amount_currency_mismatch",
        raw_response: order.raw as Record<string, unknown> | null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", tx.id);
    console.warn("[areeba/reconcile] currency mismatch", {
      reference,
      stored: tx.currency,
      got: order.currency,
    });
    return "failed";
  }

  const outcome = classifyOrder(order);

  // Pending: leave the row alone but record the latest snapshot.
  if (outcome === "pending") {
    await admin
      .from("transactions")
      .update({
        raw_response: order.raw as Record<string, unknown> | null,
      })
      .eq("id", tx.id);
    return "pending";
  }

  const baseUpdate: Record<string, unknown> = {
    raw_response: order.raw as Record<string, unknown> | null,
    response_code: order.result,
    response_message: order.status,
    authorization_code: order.authorizationCode ?? null,
    areeba_transaction_id: order.areebaTransactionId ?? null,
    processed_at: new Date().toISOString(),
  };

  if (outcome === "succeeded") {
    let subscriptionId: string | null = tx.subscription_id;
    if (!subscriptionId && tx.plan_id) {
      const periodStart = new Date();
      const periodEnd = new Date(periodStart);
      if (tx.billing_cycle === "yearly") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const { data: sub, error: subError } = await admin
        .from("subscriptions")
        .insert({
          user_id: tx.user_id,
          plan_id: tx.plan_id,
          status: "active",
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .select("id")
        .single();
      if (subError) {
        console.error(
          "[areeba/reconcile] failed to create subscription:",
          subError.message,
        );
      } else if (sub) {
        subscriptionId = sub.id;
      }
    }

    await admin
      .from("transactions")
      .update({
        ...baseUpdate,
        status: "succeeded",
        subscription_id: subscriptionId,
      })
      .eq("id", tx.id);
    return "succeeded";
  }

  await admin
    .from("transactions")
    .update({ ...baseUpdate, status: outcome })
    .eq("id", tx.id);
  return outcome;
}
