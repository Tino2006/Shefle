import type { AreebaConfig } from "./config";
import type {
  AreebaInitPayload,
  AreebaOrderApiResult,
  AreebaOrderResult,
  AreebaSessionResult,
} from "./types";

import { AreebaConfigError } from "./config";

function basicAuthHeader(config: AreebaConfig): string {
  const token = Buffer.from(
    `merchant.${config.merchantId}:${config.apiPassword}`,
  ).toString("base64");
  return `Basic ${token}`;
}

function restPath(config: AreebaConfig, suffix: string): string {
  return `${config.gatewayBaseUrl}/api/rest/version/${config.apiVersion}/merchant/${config.merchantId}${suffix}`;
}

/**
 * URL of the MPGS Checkout JS SDK that the browser must load. Calling
 * `Checkout.configure({ session: { id }})` followed by `Checkout.showPaymentPage()`
 * is the documented entry point — there is no static "/checkout.html" URL to
 * direct-redirect to. Returning this URL lets the frontend inject the script.
 */
export function areebaCheckoutScriptUrl(config: AreebaConfig): string {
  return `${config.gatewayBaseUrl}/checkout/version/${config.apiVersion}/checkout.js`;
}

/**
 * Build the Areeba init payload from a stored transaction.
 *
 * The MPGS API uses dotted field names (`order.id`, `interaction.operation`,
 * etc.) inside JSON; we keep our intermediate shape generic and let
 * `createAreebaSession` map to the wire format.
 */
export function buildInitPayload(
  config: AreebaConfig,
  args: {
    transactionReference: string;
    amount: number;
    currency: string;
    description: string;
  },
): AreebaInitPayload {
  return {
    merchantId: config.merchantId,
    transactionReference: args.transactionReference,
    amount: args.amount.toFixed(2),
    currency: args.currency.toUpperCase(),
    returnUrl: config.returnUrl,
    callbackUrl: config.callbackUrl,
    description: args.description,
  };
}

/**
 * Create a hosted-checkout session. Returns the sessionId the browser needs
 * to feed into `Checkout.configure({ session: { id }})`.
 *
 * MPGS REST: POST {base}/api/rest/version/{ver}/merchant/{merchantId}/session
 * Auth:      HTTP Basic with username `merchant.{merchantId}` and the API password.
 * Response:  { result, session: { id, version }, successIndicator? }
 *
 * The frontend then loads `<gateway>/checkout/version/{ver}/checkout.js` and
 * calls `Checkout.showPaymentPage()` — there is NO valid direct-redirect URL
 * for hosted checkout, despite what early integrations suggest.
 *
 * If the API password is missing the call short-circuits with
 * `GATEWAY_NOT_CONFIGURED`; the route returns 501 in that case.
 */
export async function createAreebaSession(
  config: AreebaConfig,
  payload: AreebaInitPayload,
): Promise<AreebaSessionResult> {
  if (!config.apiPassword) {
    throw new AreebaConfigError(
      "GATEWAY_NOT_CONFIGURED",
      "AREEBA_API_PASSWORD is not set",
    );
  }

  const body = {
    apiOperation: "CREATE_CHECKOUT_SESSION",
    interaction: {
      operation: "PURCHASE",
      merchant: { name: "Shefle" },
      returnUrl: `${payload.returnUrl}?ref=${encodeURIComponent(payload.transactionReference)}`,
      displayControl: { billingAddress: "HIDE", customerEmail: "HIDE" },
    },
    order: {
      id: payload.transactionReference,
      amount: payload.amount,
      currency: payload.currency,
      description: payload.description,
    },
  };

  const res = await fetch(restPath(config, "/session"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(config),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Areeba session create failed: ${res.status} ${res.statusText} ${text.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as {
    result?: string;
    session?: { id?: string; version?: string };
    successIndicator?: string;
    order?: { id?: string };
  };

  const sessionId = json.session?.id;
  if (!sessionId) {
    throw new Error(
      `Areeba session response missing session.id: ${JSON.stringify(json).slice(0, 500)}`,
    );
  }

  return {
    sessionId,
    successIndicator: json.successIndicator,
    areebaOrderId: json.order?.id ?? payload.transactionReference,
  };
}

/**
 * Fetch the canonical order state from Areeba. This is the **source of truth**
 * for transitioning a transaction from `pending` to `succeeded|failed|cancelled`.
 *
 * Returns `{ result: 'NOT_FOUND', ... }` (rather than throwing) when Areeba
 * 404s — that simply means the order hasn't been opened yet from the gateway's
 * perspective. The caller can leave the row at `pending` and try again later.
 */
export async function getAreebaOrder(
  config: AreebaConfig,
  orderId: string,
): Promise<AreebaOrderResult> {
  if (!config.apiPassword) {
    throw new AreebaConfigError(
      "GATEWAY_NOT_CONFIGURED",
      "AREEBA_API_PASSWORD is not set",
    );
  }

  const res = await fetch(
    restPath(config, `/order/${encodeURIComponent(orderId)}`),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: basicAuthHeader(config),
      },
      cache: "no-store",
    },
  );

  if (res.status === 404) {
    return {
      result: "NOT_FOUND",
      status: null,
      amount: null,
      currency: null,
      raw: null,
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Areeba GET order failed: ${res.status} ${res.statusText} ${text.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as {
    result?: AreebaOrderApiResult;
    status?: string | null;
    amount?: number | string | null;
    currency?: string | null;
    transaction?: Array<{
      transaction?: { id?: string };
      authorizationResponse?: { authorizationCode?: string };
    }>;
  };

  return {
    result: (json.result ?? "PENDING") as AreebaOrderApiResult,
    status: json.status ?? null,
    amount: json.amount != null ? Number(json.amount) : null,
    currency: json.currency ?? null,
    authorizationCode:
      json.transaction?.[0]?.authorizationResponse?.authorizationCode ?? null,
    areebaTransactionId: json.transaction?.[0]?.transaction?.id ?? null,
    raw: json,
  };
}
