import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRedirectPath } from '@/lib/sanitize-redirect';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const safeNext = sanitizeRedirectPath(requestUrl.searchParams.get('next'), '/');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_oauth_code', requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/login?error=oauth_exchange_failed', requestUrl.origin));
  }

  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
