import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdminApi, isErrorResponse } from '@/lib/api-middleware';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const authResult = await verifyAdminApi();
    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { id } = await params;

    // Use admin client to update (bypasses RLS)
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('contact_submissions')
      .update({ status: 'read' })
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: 'Marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
