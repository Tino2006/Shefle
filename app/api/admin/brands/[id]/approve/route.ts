import { createClient } from '@/lib/supabase/server';
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

    const { user } = authResult;
    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('brands')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: 'Brand approved successfully' });
  } catch (error) {
    console.error('Approve brand error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
