import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdminApi, isErrorResponse } from '@/lib/api-middleware';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Verify admin access
    const authResult = await verifyAdminApi();
    if (isErrorResponse(authResult)) {
      return authResult;
    }

    // Use admin client to fetch contacts (bypasses RLS)
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'new';

    const { data: contacts, error } = await adminClient
      .from('contact_submissions')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('Admin contacts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
