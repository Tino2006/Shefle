import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserByReferralCode, normalizeReferralCode } from "@/lib/referral";
import { createAuthRouteClient } from "@/lib/supabase/auth-route";

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  referralCode: z.string().optional(),
});

/** Public URL for email confirmation links (must match Supabase Auth → Redirect URLs). */
function getPublicAppUrl(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");

  if (fromEnv && !fromEnv.includes("localhost")) {
    return fromEnv;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      firstName,
      lastName,
      referralCode: referralCodeRaw,
    } = signUpSchema.parse(body);

    let referralMeta: string | undefined;

    if (referralCodeRaw != null && String(referralCodeRaw).trim() !== "") {
      const normalized = normalizeReferralCode(referralCodeRaw);

      if (!normalized) {
        return NextResponse.json(
          { error: "Invalid referral code format" },
          { status: 400 },
        );
      }
      const referrer = await getUserByReferralCode(normalized);

      if (!referrer) {
        return NextResponse.json(
          { error: "Referral code not found" },
          { status: 400 },
        );
      }
      referralMeta = normalized;
    }

    const supabase = createAuthRouteClient();
    const appUrl = getPublicAppUrl(request);

    const emailRedirectTo = `${appUrl}/auth/confirm?next=${encodeURIComponent("/login?verified=1")}`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          first_name: firstName,
          last_name: lastName,
          ...(referralMeta ? { referral_code: referralMeta } : {}),
        },
      },
    });

    if (error) {
      const isAlreadyRegistered = /already registered/i.test(error.message);

      if (isAlreadyRegistered) {
        const { error: resendError } = await supabase.auth.resend({
          type: "signup",
          email,
          options: {
            emailRedirectTo,
          },
        });

        if (!resendError) {
          return NextResponse.json({
            message:
              "Account already exists but is not confirmed. We sent a new verification email.",
          });
        }

        const isRateLimited =
          /rate limit/i.test(resendError.message) ||
          /security purposes/i.test(resendError.message);

        if (isRateLimited) {
          return NextResponse.json(
            {
              error:
                "Please wait a minute before requesting another confirmation email.",
            },
            { status: 429 },
          );
        }
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Profile row: DB trigger on auth.users + ensureProfileIfMissing() after first login/session
    // (inserting profiles immediately after signUp() can race FK to auth.users and fail with 23503).

    return NextResponse.json({
      message:
        "Registration successful! Please check your email to verify your account.",
      user: data.user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
