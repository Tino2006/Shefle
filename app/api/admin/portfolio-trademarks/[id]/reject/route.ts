import { verifyAdminApi, isErrorResponse } from '@/lib/api-middleware';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { z } from 'zod';

const rejectSchema = z.object({
  reason: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdminApi();
    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { user } = authResult;
    const { id } = await params;
    const body = await request.json();
    const { reason } = rejectSchema.parse(body);

    const result = await query(
      `
        UPDATE public.portfolio_trademarks
        SET
          approval_status = 'rejected',
          rejection_reason = $3,
          reviewed_at = NOW(),
          reviewed_by = $2::uuid
        WHERE id = $1::bigint AND approval_status = 'pending'
      `,
      [id, user.id, reason]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'No pending trademark found with this id' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Trademark rejected' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Reject portfolio trademark error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
