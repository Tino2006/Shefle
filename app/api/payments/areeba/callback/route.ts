import type { AreebaCallbackParams } from "@/lib/areeba/types";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { readAreebaHashSecret } from "@/lib/areeba/config";
import { verifyAreebaHash } from "@/lib/areeba/hash";

/**
 * Parse the gateway response body as a flat string→string map. Areeba/MPGS may
 * return either application/x-www-form-urlencoded (form-post flow) or JSON
 * (REST flow); we accept both. Always read raw text first so we can store the
 * exact payload for forensic logging.
 */
async function parseAreebaParams(
  request: Request,
): Promise<{ raw: string; params: AreebaCallbackParams }> {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();

  if (request.method === "GET") {
    const url = new URL(request.url);
    const params: AreebaCallbackParams = {};

    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return { raw: url.search, params };
  }

  const raw = await request.text();

  if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(raw) as Record<string, unknown>;
      const params: AreebaCallbackParams = {};

      for (const [k, v] of Object.entries(json)) {
        params[k] = v == null ? undefined : String(v);
      }

      return { raw, params };
    } catch {
      return { raw, params: {} };
    }
  }

  // Default: form-encoded.
  const usp = new URLSearchParams(raw);
  const params: AreebaCallbackParams = {};

  usp.forEach((value, key) => {
    params[key] = value;
  });

  return { raw, params };
}

/**
 * Pluck the transaction reference from a callback payload. Areeba/MPGS field
 * names vary by integration mode; check the most common names in priority order.
 */
function pluckReference(params: AreebaCallbackParams): string | null {
  return (
    params.transactionReference ||
    params.transaction_reference ||
    params.merchantTxnRef ||
    params["order.id"] ||
    params.orderId ||
    null
  );
}

function isApprovedResponse(params: AreebaCallbackParams): boolean {
  // Common MPGS approval markers — check actual doc when wiring real verification.
  if (params.result === "SUCCESS") return true;
  if (params.responseCode === "0") return true;
  if (params.response_code === "0") return true;

  return false;
}

async function handle(request: Request) {
  const admin = createAdminClient();
  const { raw, params } = await parseAreebaParams(request);

  const reference = pluckReference(params);

  if (!reference) {
    console.warn("[areeba/callback] missing transaction reference", { raw });

    return NextResponse.json(
      { error: "Missing transaction reference" },
      { status: 400 },
    );
  }

  const { data: tx, error: lookupError } = await admin
    .from("transactions")
    .select("*")
    .eq("transaction_reference", reference)
    .eq("provider", "areeba")
    .maybeSingle();

  if (lookupError) {
    console.error("[areeba/callback] lookup failed:", lookupError.message);

    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!tx) {
    console.warn("[areeba/callback] unknown transaction reference", {
      reference,
    });

    return NextResponse.json({ error: "Unknown transaction" }, { status: 404 });
  }

  // Idempotency: only the first valid response is processed (Annex B §6).
  const terminalStatuses = new Set(["succeeded", "failed", "cancelled"]);

  if (terminalStatuses.has(tx.status)) {
    console.info("[areeba/callback] duplicate ignored", {
      reference,
      status: tx.status,
    });

    return NextResponse.json({ ok: true, ignored: true });
  }

  // Validate returned amount + currency match what we stored.
  const returnedAmount =
    params["order.amount"] ?? params.amount ?? params.transactionAmount ?? null;
  const returnedCurrency =
    params["order.currency"] ??
    params.currency ??
    params.transactionCurrency ??
    null;

  if (returnedAmount != null) {
    const a = Number(returnedAmount);

    if (!Number.isFinite(a) || Math.abs(a - Number(tx.amount)) > 0.01) {
      await admin
        .from("transactions")
        .update({
          status: "failed",
          response_message: "amount_currency_mismatch",
          raw_response: params,
          processed_at: new Date().toISOString(),
        })
        .eq("id", tx.id);
      console.warn("[areeba/callback] amount mismatch", {
        reference,
        expected: tx.amount,
        got: returnedAmount,
      });

      return NextResponse.json({ ok: true });
    }
  }
  if (
    returnedCurrency &&
    String(returnedCurrency).toUpperCase() !== String(tx.currency).toUpperCase()
  ) {
    await admin
      .from("transactions")
      .update({
        status: "failed",
        response_message: "amount_currency_mismatch",
        raw_response: params,
        processed_at: new Date().toISOString(),
      })
      .eq("id", tx.id);
    console.warn("[areeba/callback] currency mismatch", {
      reference,
      expected: tx.currency,
      got: returnedCurrency,
    });

    return NextResponse.json({ ok: true });
  }

  // Hash verification — short-circuits the entire decision.
  const secret = readAreebaHashSecret();
  const verified = verifyAreebaHash(params, secret);

  const responseCode =
    params.responseCode || params.response_code || params.result || null;
  const responseMessage = params.responseMessage || params.message || null;
  const authorizationCode = params.authorizationCode || params.authCode || null;
  const areebaOrderId =
    params["order.id"] || params.orderId || tx.areeba_order_id || null;
  const areebaTransactionId =
    params["transaction.id"] ||
    params.transactionId ||
    params.transaction_id ||
    null;

  const baseUpdate = {
    raw_response: params,
    response_code: responseCode,
    response_message: responseMessage,
    authorization_code: authorizationCode,
    areeba_order_id: areebaOrderId,
    areeba_transaction_id: areebaTransactionId,
    processed_at: new Date().toISOString(),
  };

  if (!verified) {
    // Quarantine. Annex B §3: signature failure ⇒ declined regardless of response code.
    // While the secret is missing entirely we keep the row at 'pending_verification'
    // so a real success isn't lost — once the secret + algo land we can re-process.
    const quarantineStatus = secret ? "failed" : "pending_verification";

    await admin
      .from("transactions")
      .update({
        ...baseUpdate,
        status: quarantineStatus,
        response_message: responseMessage || "hash_verification_failed",
      })
      .eq("id", tx.id);
    console.warn("[areeba/callback] hash unverified", {
      reference,
      hasSecret: Boolean(secret),
      quarantineStatus,
    });

    return NextResponse.json({ ok: true });
  }

  if (!isApprovedResponse(params)) {
    await admin
      .from("transactions")
      .update({ ...baseUpdate, status: "failed" })
      .eq("id", tx.id);

    return NextResponse.json({ ok: true });
  }

  // Verified + approved → mark succeeded and create the subscription.
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);

  if (tx.billing_cycle === "yearly") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  let subscriptionId: string | null = null;

  if (tx.plan_id) {
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
        "[areeba/callback] failed to create subscription:",
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

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
