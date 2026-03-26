import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/postgres';

/**
 * Get Single Watchlist Hit API
 * GET /api/watchlists/hits/[id] - Get detailed information about a specific alert
 */

interface WatchlistHitDetail {
  // Hit info
  id: string;
  watchlist_id: string;
  watchlist_query: string;
  watchlist_min_similarity: number;
  trademark_id: string;
  similarity_score: number;
  risk_level: string;
  review_status: string;
  reviewed_at: string | null;
  note: string | null;
  first_seen_at: string;
  
  // Trademark info
  trademark_serial_number: string;
  trademark_registration_number: string | null;
  trademark_mark_text: string | null;
  trademark_status_raw: string | null;
  trademark_status_norm: string | null;
  trademark_filing_date: string | null;
  trademark_registration_date: string | null;
  trademark_owner_name: string | null;
  trademark_goods_services_text: string | null;
  trademark_office: string;
  
  // Classes
  trademark_classes: number[] | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const hitId = id;

    // Fetch detailed hit information with trademark data
    const hit = await queryOne<WatchlistHitDetail>(
      `
        SELECT 
          wh.id::text,
          wh.watchlist_id::text,
          w.query AS watchlist_query,
          w.min_similarity AS watchlist_min_similarity,
          wh.trademark_id::text,
          wh.similarity_score,
          wh.risk_level,
          wh.review_status,
          wh.reviewed_at::text,
          wh.note,
          wh.first_seen_at::text,
          
          -- Trademark details
          t.serial_number AS trademark_serial_number,
          t.registration_number AS trademark_registration_number,
          t.mark_text AS trademark_mark_text,
          t.status_raw AS trademark_status_raw,
          t.status_norm AS trademark_status_norm,
          t.filing_date::text AS trademark_filing_date,
          t.registration_date::text AS trademark_registration_date,
          t.owner_name AS trademark_owner_name,
          t.goods_services_text AS trademark_goods_services_text,
          t.office AS trademark_office,
          
          -- Classes (aggregated)
          ARRAY_AGG(tc.nice_class ORDER BY tc.nice_class) FILTER (WHERE tc.nice_class IS NOT NULL) AS trademark_classes
        FROM public.watchlist_hits wh
        INNER JOIN public.watchlists w ON wh.watchlist_id = w.id
        INNER JOIN public.trademarks t ON wh.trademark_id = t.id
        LEFT JOIN public.trademark_classes tc ON t.id = tc.trademark_id
        WHERE wh.id = $1
        GROUP BY 
          wh.id, w.id, t.id
      `,
      [hitId]
    );

    if (!hit) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      hit,
    });

  } catch (error) {
    console.error('Get watchlist hit error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch alert details',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
