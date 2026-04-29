import type { AreebaCallbackParams } from "./types";

/**
 * Verify the Secure Hash returned by Areeba on a callback / return URL.
 *
 * SCAFFOLD ONLY — returns `false` until both:
 *   1. AREEBA_HASH_SECRET is configured, AND
 *   2. The TODO block below is filled in with the canonical algorithm
 *      from the Areeba / MPGS integration doc. Per Annex B §3, a failed
 *      verification means the transaction is treated as DECLINED even
 *      if the response code is approval (0). Do not weaken this contract.
 *
 * Canonical MPGS algorithm (confirm against the merchant doc before enabling):
 *   - Drop the `secureHash` (or `hash`) field from `params`.
 *   - Drop empty-valued fields (per MPGS docs).
 *   - Sort the remaining fields alphabetically by key.
 *   - Concatenate as `key=value` joined by `&` (or just values joined; doc-dependent).
 *   - HMAC-SHA256 with the Secure Hash Secret as key.
 *   - Hex-encode the digest, lowercase, compare to the received hash.
 *   - Use a constant-time comparison (crypto.timingSafeEqual on equal-length buffers).
 */
export function verifyAreebaHash(
  params: AreebaCallbackParams,
  secret: string | null | undefined,
): boolean {
  if (!secret) return false;

  // TODO(areeba): implement per the Areeba integration guide once the Secure
  // Hash Secret is available. Until then this MUST stay `false` so that
  // callbacks are quarantined as `pending_verification`, never `paid`.
  void params;

  return false;
}
