import type { EmailOtpType } from "@supabase/supabase-js";

import { NextResponse } from "next/server";

import { ensureProfileIfMissing } from "@/lib/ensure-profile";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectPath } from "@/lib/sanitize-redirect";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const safeNext = sanitizeRedirectPath(
    requestUrl.searchParams.get("next"),
    "/",
  );

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_confirmation_link", requestUrl.origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(
        "/login?error=access_denied&error_code=otp_expired",
        requestUrl.origin,
      ),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const ensured = await ensureProfileIfMissing(user, supabase);

    if (!ensured.ok) {
      console.error("[auth/confirm] ensureProfileIfMissing:", ensured.error);

      return NextResponse.redirect(
        new URL("/login?error=profile_not_created", requestUrl.origin),
      );
    }
  }

  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
