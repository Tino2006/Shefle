export type AreebaBillingCycle = "monthly" | "yearly";

export type AreebaPlanSlug = "starter" | "growth" | "enterprise";

export interface AreebaInitPayload {
  merchantId: string;
  transactionReference: string;
  amount: string;
  currency: string;
  returnUrl: string;
  callbackUrl: string;
  description: string;
}

export interface AreebaSessionResult {
  sessionId: string;
  successIndicator?: string;
  areebaOrderId?: string;
}

/**
 * Loosely typed callback payload — Areeba/MPGS field set varies by integration mode
 * (hosted-checkout returns different keys than the deprecated form-post flow). We
 * accept arbitrary string-valued fields and pull what we need by name.
 */
export type AreebaCallbackParams = Record<string, string | undefined>;

/**
 * MPGS canonical "result" enum on the GET /order/{id} response. We treat NOT_FOUND
 * as a soft 404 from our client (the order may not have been opened yet).
 */
export type AreebaOrderApiResult = "SUCCESS" | "FAILURE" | "PENDING" | "ERROR" | "NOT_FOUND";

/**
 * Subset of MPGS canonical "status" values we care about for state-machine transitions.
 * Real responses can include additional values; we treat unknowns as PENDING.
 */
export type AreebaOrderApiStatus =
  | "CAPTURED"
  | "AUTHORIZED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED"
  | "DECLINED"
  | string
  | null;

export interface AreebaOrderResult {
  result: AreebaOrderApiResult;
  status: AreebaOrderApiStatus;
  amount: number | null;
  currency: string | null;
  authorizationCode?: string | null;
  areebaTransactionId?: string | null;
  raw: unknown;
}
