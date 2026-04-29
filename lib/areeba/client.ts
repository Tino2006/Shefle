import type { AreebaConfig } from "./config";
import type { AreebaInitPayload, AreebaSessionResult } from "./types";

import { AreebaConfigError } from "./config";

/**
 * Build the Areeba init payload from a stored transaction.
 *
 * Field names follow the MPGS hosted-checkout convention; confirm against the
 * actual Areeba doc once the team has access — different MPGS deployments use
 * `order.id` / `transaction.reference` / `merchant.id` etc. We keep the field
 * names here generic and let `createAreebaSession` map to the wire format.
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
 * Call Areeba's session/initialize endpoint and return a redirect URL.
 *
 * SCAFFOLD ONLY — until AREEBA_GATEWAY_BASE_URL and the exact endpoint shape
 * are confirmed against the integration doc, this throws AreebaConfigError so
 * the route returns 501 with `GATEWAY_NOT_CONFIGURED`.
 *
 * When wiring this up:
 *   - MPGS hosted checkout: POST {baseUrl}/api/rest/version/{ver}/merchant/{merchantId}/session
 *     with HTTP Basic auth: username=`merchant.{merchantId}`, password=AREEBA_API_PASSWORD.
 *     Body includes interaction.operation=PURCHASE, order.id, order.amount, order.currency,
 *     and returns { session: { id } }. The redirect URL is then constructed via the
 *     hosted-checkout JS or a direct URL pattern from the doc.
 *   - Some Areeba deployments use a form-post flow instead; in that case `redirectUrl`
 *     would be a GET URL to the gateway with signed query params (uses verifyAreebaHash
 *     in reverse to sign).
 */
export async function createAreebaSession(
  config: AreebaConfig,
  payload: AreebaInitPayload,
): Promise<AreebaSessionResult> {
  if (!config.gatewayBaseUrl) {
    throw new AreebaConfigError(
      "GATEWAY_NOT_CONFIGURED",
      "Areeba gateway endpoint not configured yet",
    );
  }

  // TODO(areeba): replace this guard with the real fetch once the doc is
  // confirmed. The shape below is the MPGS REST template — verify before use.
  //
  // const url = `${config.gatewayBaseUrl}/api/rest/version/100/merchant/${config.merchantId}/session`;
  // const auth = Buffer.from(`merchant.${config.merchantId}:${config.apiPassword}`).toString('base64');
  // const res = await fetch(url, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     Authorization: `Basic ${auth}`,
  //   },
  //   body: JSON.stringify({
  //     apiOperation: 'INITIATE_CHECKOUT',
  //     interaction: {
  //       operation: 'PURCHASE',
  //       returnUrl: payload.returnUrl,
  //     },
  //     order: {
  //       id: payload.transactionReference,
  //       amount: payload.amount,
  //       currency: payload.currency,
  //       description: payload.description,
  //     },
  //   }),
  // });
  // if (!res.ok) throw new Error(`Areeba session create failed: ${res.status}`);
  // const data = await res.json();
  // return {
  //   redirectUrl: `${config.gatewayBaseUrl}/checkout/version/100/checkout.html?checkoutVersion=1.0.0&sessionId=${data.session.id}`,
  //   sessionId: data.session.id,
  //   areebaOrderId: data.order?.id,
  // };

  void payload;
  throw new AreebaConfigError(
    "GATEWAY_NOT_CONFIGURED",
    "Areeba gateway endpoint not configured yet",
  );
}
