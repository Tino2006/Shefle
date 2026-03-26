import { NextRequest, NextResponse } from 'next/server';
import { queryRows } from '@/lib/db/postgres';

/**
 * Watchlist Hits API
 * GET /api/watchlists/hits - Get recent alerts across all user's watchlists
 * Query params:
 *  - limit: Number of results (default 50)
 *  - watchlist_id: Filter by specific watchlist
 *  - review_status: Filter by review status (NEW, REVIEWED, DISMISSED, ESCALATED)
 */

interface WatchlistHitWithDetails {
  id: string;
  watchlist_id: string;
  watchlist_query: string;
  trademark_id: string;
  trademark_serial_number: string;
  trademark_mark_text: string | null;
  trademark_registration_number: string | null;
  trademark_owner_name: string | null;
  trademark_status_norm: string | null;
  trademark_filing_date: string | null;
  similarity_score: number;
  risk_level: string;
  review_status: string;
  reviewed_at: string | null;
  note: string | null;
  first_seen_at: string;
}

export async function GET(request: NextRequest) {
  try {
    // For MVP, we'll use a mock user_id
    const mockUserId = '00000000-0000-0000-0000-000000000001';

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const watchlistId = searchParams.get('watchlist_id');
    const reviewStatus = searchParams.get('review_status');

    // Validate review_status if provided
    if (reviewStatus && !['NEW', 'REVIEWED', 'DISMISSED', 'ESCALATED'].includes(reviewStatus)) {
      return NextResponse.json(
        { error: 'Invalid review_status. Must be: NEW, REVIEWED, DISMISSED, or ESCALATED' },
        { status: 400 }
      );
    }

    // Build WHERE clauses
    const whereClauses = ['w.user_id = $1'];
    const queryParams: any[] = [mockUserId];
    let paramIndex = 2;

    if (watchlistId) {
      whereClauses.push(`wh.watchlist_id = $${paramIndex}`);
      queryParams.push(watchlistId);
      paramIndex++;
    }

    if (reviewStatus) {
      whereClauses.push(`wh.review_status = $${paramIndex}`);
      queryParams.push(reviewStatus);
      paramIndex++;
    }

    queryParams.push(limit);

    // Fetch recent hits with trademark details and review info
    const hits = await queryRows<WatchlistHitWithDetails>(
      `
        SELECT 
          wh.id::text,
          wh.watchlist_id::text,
          w.query AS watchlist_query,
          wh.trademark_id::text,
          wh.trademark_serial_number,
          t.mark_text AS trademark_mark_text,
          t.registration_number AS trademark_registration_number,
          t.owner_name AS trademark_owner_name,
          t.status_norm AS trademark_status_norm,
          t.filing_date::text AS trademark_filing_date,
          wh.similarity_score,
          wh.risk_level,
          wh.review_status,
          wh.reviewed_at::text,
          wh.note,
          wh.first_seen_at::text
        FROM public.watchlist_hits wh
        INNER JOIN public.watchlists w ON wh.watchlist_id = w.id
        INNER JOIN public.trademarks t ON wh.trademark_id = t.id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY wh.first_seen_at DESC
        LIMIT $${paramIndex}
      `,
      queryParams
    );

    return NextResponse.json({
      success: true,
      hits,
      count: hits.length,
      filters: {
        watchlist_id: watchlistId,
        review_status: reviewStatus,
      },
    });

  } catch (error) {
    console.error('Get watchlist hits error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch watchlist hits',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
