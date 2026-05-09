import type { AreebaCallbackParams } from "./types";

/**
 * Verify the Secure Hash returned by Areeba on a webhook / return URL.
 *
 * SCOPE: forensic / tamper-detection ONLY.
 *
 * As of the GET-as-truth architecture (per Areeba's own guidance),
 * payment status decisions are made by calling the authenticated
 * `GET /api/rest/.../order/{id}` endpoint over TLS. This function's
 * boolean return is logged alongside the webhook payload but does not
 * drive any state transition. If the hash doesn't match a real
 * payload, that's a signal worth investigating, not a reason to flip
 * the row to `failed`.
 *
 * Returns `false` until both:
 *   1. AREEBA_HASH_SECRET is configured, AND
 *   2. The TODO block below is filled in with the canonical algorithm
 *      from the Areeba / MPGS integration doc.
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
  // Hash Secret is available. Forensic-only; do not gate payment decisions.
  void params;

  return false;
}
