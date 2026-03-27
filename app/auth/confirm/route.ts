import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null;
  const nextPath = requestUrl.searchParams.get('next') || '/';
  const safeNext = nextPath.startsWith('/') ? nextPath : '/';

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/login?error=invalid_confirmation_link', requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(
      new URL('/login?error=access_denied&error_code=otp_expired', requestUrl.origin)
    );
  }

  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
