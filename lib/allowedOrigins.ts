/**
 * Origins allowed for this app (env override + defaults).
 * Used for diagnostics; API routes do not reject by origin unless a route opts in.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.shefle.com",
  "https://shefle.com",
  "https://shefle.vercel.app",
];

export function getAllowedOrigins(): string[] {
  const fromEnv =
    process.env.ALLOWED_ORIGINS?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? [];

  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv]));
}

/** Whether an Origin header value is in the allowlist (null/empty → false). */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  return getAllowedOrigins().includes(origin);
}
