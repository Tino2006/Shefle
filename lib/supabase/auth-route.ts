import { createClient } from "@supabase/supabase-js";

/**
 * Anon Supabase client for Route Handlers that call Auth APIs (signUp, resend, etc.).
 * Avoids @supabase/ssr cookie adapters here — using those for signUp can interfere with
 * Auth behavior in API routes; session cookies are not needed when email confirmation is required.
 */
export function createAuthRouteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
