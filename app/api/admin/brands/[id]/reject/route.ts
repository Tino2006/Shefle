import { createClient } from '@/lib/supabase/server';
import { verifyAdminApi, isErrorResponse } from '@/lib/api-middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const rejectSchema = z.object({
  reason: z.string().min(1),
});

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
    const body = await request.json();
    const { reason } = rejectSchema.parse(body);

    const supabase = await createClient();

    const { error } = await supabase
      .from('brands')
      .update({
        status: 'rejected',
        rejection_reason: reason,
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

    return NextResponse.json({ message: 'Brand rejected' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Reject brand error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
