import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/postgres';

/**
 * Watchlist Hit Review API
 * PATCH /api/watchlists/hits/[id]/review
 * Updates review status, note, and reviewed_at timestamp
 */

interface ReviewRequest {
  review_status: 'NEW' | 'REVIEWED' | 'DISMISSED' | 'ESCALATED';
  note?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const hitId = id;

    // Parse request body
    const body: ReviewRequest = await request.json();

    // Validate review_status
    if (!['NEW', 'REVIEWED', 'DISMISSED', 'ESCALATED'].includes(body.review_status)) {
      return NextResponse.json(
        { error: 'Invalid review_status. Must be: NEW, REVIEWED, DISMISSED, or ESCALATED' },
        { status: 400 }
      );
    }

    // Update the hit
    const result = await queryOne(
      `
        UPDATE public.watchlist_hits
        SET 
          review_status = $2,
          reviewed_at = NOW(),
          note = $3
        WHERE id = $1
        RETURNING 
          id::text,
          review_status,
          reviewed_at::text,
          note
      `,
      [hitId, body.review_status, body.note || null]
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Watchlist hit not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      hit: result,
    });

  } catch (error) {
    console.error('Review hit error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update review status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
