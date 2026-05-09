function requireHttps(name: string, value: string | undefined): string | null {
  if (!value) return null;
  if (!/^https:\/\//i.test(value)) {
    throw new Error(`${name} must be an https:// URL (got "${value}")`);
  }

  return value.replace(/\/+$/, "");
}

const DEFAULT_GATEWAY_BASE_URL = "https://epayment.areeba.com";
const DEFAULT_API_VERSION = "100";

export interface AreebaConfig {
  merchantId: string;
  apiPassword: string;
  hashSecret: string | null;
  gatewayBaseUrl: string;
  apiVersion: string;
  returnUrl: string;
  callbackUrl: string;
  currency: string;
}

export class AreebaConfigError extends Error {
  code: "GATEWAY_NOT_CONFIGURED" | "CONFIG_ERROR";
  constructor(code: AreebaConfigError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "AreebaConfigError";
  }
}

/**
 * Load Areeba env vars. Throws AreebaConfigError if anything required for
 * initiating a payment is missing (the caller turns this into a 501 response).
 *
 * `hashSecret` is intentionally optional: as of the GET-as-truth architecture
 * shift, hash verification is forensic-only and does not drive payment status.
 *
 * Defaults applied when env is unset:
 *   - gatewayBaseUrl → https://epayment.areeba.com (same host as merchant dashboard)
 *   - apiVersion     → "100" (current MPGS REST version; override if Areeba doc differs)
 */
export function loadAreebaConfig(): AreebaConfig {
  const merchantId = process.env.AREEBA_MERCHANT_ID?.trim();
  const apiPassword = process.env.AREEBA_API_PASSWORD?.trim();
  const hashSecret = process.env.AREEBA_HASH_SECRET?.trim() || null;
  const gatewayBaseUrl =
    requireHttps(
      "AREEBA_GATEWAY_BASE_URL",
      process.env.AREEBA_GATEWAY_BASE_URL?.trim(),
    ) ?? DEFAULT_GATEWAY_BASE_URL;
  const apiVersion =
    process.env.AREEBA_API_VERSION?.trim() || DEFAULT_API_VERSION;
  const returnUrl = requireHttps(
    "AREEBA_RETURN_URL",
    process.env.AREEBA_RETURN_URL?.trim(),
  );
  const callbackUrl = requireHttps(
    "AREEBA_CALLBACK_URL",
    process.env.AREEBA_CALLBACK_URL?.trim(),
  );
  const currency = (process.env.AREEBA_CURRENCY?.trim() || "USD").toUpperCase();

  if (!merchantId) {
    throw new AreebaConfigError(
      "GATEWAY_NOT_CONFIGURED",
      "AREEBA_MERCHANT_ID is not set",
    );
  }
  if (!apiPassword) {
    throw new AreebaConfigError(
      "GATEWAY_NOT_CONFIGURED",
      "AREEBA_API_PASSWORD is not set — generate it from the merchant dashboard",
    );
  }
  if (!returnUrl) {
    throw new AreebaConfigError("CONFIG_ERROR", "AREEBA_RETURN_URL is not set");
  }
  if (!callbackUrl) {
    throw new AreebaConfigError(
      "CONFIG_ERROR",
      "AREEBA_CALLBACK_URL is not set",
    );
  }

  return {
    merchantId,
    apiPassword,
    hashSecret,
    gatewayBaseUrl,
    apiVersion,
    returnUrl,
    callbackUrl,
    currency,
  };
}

/** Read just the hash secret (callback path; never throws). */
export function readAreebaHashSecret(): string | null {
  return process.env.AREEBA_HASH_SECRET?.trim() || null;
}
