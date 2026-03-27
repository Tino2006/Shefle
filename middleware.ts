import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback', '/auth/confirm', '/about', '/pricing', '/blog', '/docs', '/contact'];

function isPublicRoute(pathname: string) {
  return publicRoutes.some(route => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  try {
    let supabaseResponse = NextResponse.next({
      request,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Avoid hard crash during startup/misconfiguration; let app continue
    // and fail gracefully on protected routes instead.
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(
        'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY'
      );

      if (isPublicRoute(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/api')) {
        return supabaseResponse;
      }

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Some edge runtimes can treat request cookies as immutable.
            try {
              cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            } catch {
              // noop: we still set cookies on the response below
            }
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Refresh session if expired - catch errors if Supabase is unreachable
    let user = null;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    } catch (error) {
      console.error('Auth error in middleware:', error);
      // Continue without user if auth fails
    }

    // Allow public routes and API routes
    if (isPublicRoute(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/api')) {
      return supabaseResponse;
    }

    // For admin routes, require authentication AND admin role
    if (request.nextUrl.pathname.startsWith('/admin')) {
      // Check if user is authenticated
      if (!user) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/login';
        redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
      }

      // Check if user has admin role
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!profile || profile.role !== 'admin') {
          // User is authenticated but not an admin - redirect to home with error
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = '/';
          redirectUrl.searchParams.set('error', 'unauthorized');
          return NextResponse.redirect(redirectUrl);
        }
      } catch (error) {
        console.error('Admin profile check failed in middleware:', error);
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/login';
        redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
      }

      return supabaseResponse;
    }

    // Redirect to login if not authenticated (for all other routes including homepage)
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return supabaseResponse;
  } catch (error) {
    console.error('Unhandled middleware error:', error);
    // Never hard-fail middleware in production; degrade gracefully.
    if (isPublicRoute(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.next({ request });
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
