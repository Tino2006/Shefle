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
  redirectUrl: string;
  sessionId?: string;
  areebaOrderId?: string;
}

/**
 * Loosely typed callback payload — Areeba/MPGS field set varies by integration mode
 * (hosted-checkout returns different keys than the deprecated form-post flow). We
 * accept arbitrary string-valued fields and pull what we need by name.
 */
export type AreebaCallbackParams = Record<string, string | undefined>;
