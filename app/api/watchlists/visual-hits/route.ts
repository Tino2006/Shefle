import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { queryRows } from '@/lib/db/postgres';

/**
 * Visual Hits API
 * GET /api/watchlists/visual-hits           - all visual hits for the user
 * GET /api/watchlists/visual-hits?watchlist_id=X - visual hits for a specific monitor
 */

interface VisualHit {
  id: string;
  watchlist_id: string;
  watchlist_query: string;
  image_url: string;
  page_url: string | null;
  entity_label: string | null;
  source: string;
  similarity_score: number;
  first_seen_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const watchlistId = request.nextUrl.searchParams.get('watchlist_id');

    const params: any[] = [user.id];
    let whereClause = '';

    if (watchlistId) {
      whereClause = 'AND vh.watchlist_id = $2';
      params.push(watchlistId);
    }

    const hits = await queryRows<VisualHit>(
      `
        SELECT
          vh.id::text,
          vh.watchlist_id::text,
          w.query AS watchlist_query,
          vh.image_url,
          vh.page_url,
          vh.entity_label,
          vh.source,
          vh.similarity_score,
          vh.first_seen_at::text
        FROM public.watchlist_visual_hits vh
        JOIN public.watchlists w ON w.id = vh.watchlist_id
        WHERE w.user_id = $1
          ${whereClause}
        ORDER BY vh.similarity_score DESC
        LIMIT 50
      `,
      params
    );

    return NextResponse.json({ success: true, hits });
  } catch (error) {
    console.error('Visual hits fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch visual hits',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
