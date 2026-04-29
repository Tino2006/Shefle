/**
 * Restrict post-auth redirects to same-site relative paths only.
 * Blocks open redirects (//evil.com, https://..., etc.).
 */
export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (raw == null || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();

  if (trimmed === "") return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return fallback;
  if (!trimmed.startsWith("/")) return fallback;

  return trimmed;
}
