import type { AreebaCallbackParams } from "@/lib/areeba/types";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { readAreebaHashSecret } from "@/lib/areeba/config";
import { verifyAreebaHash } from "@/lib/areeba/hash";
import { reconcileTransaction } from "@/lib/areeba/reconcile";

/**
 * Areeba callback endpoint — DEMOTED.
 *
 * Architecture note (2026-04-30): per Areeba's own guidance, the webhook is
 * unreliable and must NOT drive payment status. We use it only to:
 *   1. Persist the raw payload (`raw_response`) for forensic logging.
 *   2. Trigger a server-to-server reconcile via the GET /order API, which is
 *      the actual source of truth.
 * Status transitions live entirely inside `reconcileTransaction`.
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

  const usp = new URLSearchParams(raw);
  const params: AreebaCallbackParams = {};

  usp.forEach((value, key) => {
    params[key] = value;
  });

  return { raw, params };
}

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

  // Forensic-only hash check. Stored alongside the payload; does not affect status.
  const secret = readAreebaHashSecret();
  const hashVerified = secret ? verifyAreebaHash(params, secret) : null;

  // Log the webhook payload regardless of whether the row exists yet.
  await admin
    .from("transactions")
    .update({
      raw_response: { ...params, _webhook: { hash_verified: hashVerified, received_at: new Date().toISOString() } },
    })
    .eq("transaction_reference", reference)
    .eq("provider", "areeba");

  // Source of truth: server-to-server GET via reconcile helper.
  const outcome = await reconcileTransaction(reference);

  if (outcome === "not_found") {
    console.warn("[areeba/callback] unknown transaction reference", {
      reference,
    });
    return NextResponse.json({ error: "Unknown transaction" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, outcome });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
