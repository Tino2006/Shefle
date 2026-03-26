import { createClient } from './supabase/server';
import { NextResponse } from 'next/server';

/**
 * API middleware to verify admin role
 * Use this in all admin API routes
 * 
 * @returns Promise<{ user, profile } | NextResponse>
 * Returns user and profile if authorized, otherwise returns error response
 */
export async function verifyAdminApi() {
  const supabase = await createClient();
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Check admin role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Profile not found' },
      { status: 404 }
    );
  }

  if (profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 }
    );
  }

  // Return user and profile for use in the API route
  return { user, profile };
}

/**
 * Type guard to check if verifyAdminApi returned an error response
 */
export function isErrorResponse(result: any): result is NextResponse {
  return result instanceof NextResponse;
}
