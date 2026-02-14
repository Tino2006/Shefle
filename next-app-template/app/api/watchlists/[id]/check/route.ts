import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, queryRows } from '@/lib/db/postgres';

/**
 * Watchlist Check API
 * POST /api/watchlists/[id]/check
 * Runs the watchlist search and stores new hits
 */

interface TrademarkSearchResult {
  id: string;
  serial_number: string;
  mark_text: string | null;
  sim_trgm: number;
  sim_final: number;
  rank: number;
}

interface WatchlistHit {
  id: string;
  watchlist_id: string;
  trademark_id: string;
  trademark_serial_number: string;
  similarity_score: number;
  risk_level: string;
  first_seen_at: string;
}

function calculateRiskLevel(similarity: number): 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW' {
  if (similarity >= 0.8) return 'HIGH';
  if (similarity >= 0.6) return 'MEDIUM';
  if (similarity >= 0.4) return 'LOW';
  return 'VERY_LOW';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const watchlistId = id;

    // Fetch watchlist details
    const watchlist = await queryOne<{
      id: string;
      query: string;
      min_similarity: number;
      status_filter: string;
      class_filter: number[] | null;
    }>(
      `
        SELECT 
          id::text,
          query,
          min_similarity,
          status_filter,
          class_filter
        FROM public.watchlists
        WHERE id = $1
      `,
      [watchlistId]
    );

    if (!watchlist) {
      return NextResponse.json(
        { error: 'Watchlist not found' },
        { status: 404 }
      );
    }

    // Parse status filter
    const statusValues = watchlist.status_filter
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => ['ACTIVE', 'PENDING', 'DEAD'].includes(s));

    // 🎯 TWO-STAGE SIMILARITY: Trigram for candidates, Token-based for final ranking
    // Build search query with two-stage scoring
    const searchQuery = `
      WITH candidates AS (
        -- Stage 1: Use trigram for candidate selection
        SELECT
          t.id,
          t.serial_number,
          t.mark_text,
          similarity(
            LOWER(unaccent(COALESCE(t.mark_text, ''))),
            LOWER(unaccent($1))
          ) AS trgm_score
        FROM public.trademarks t
        ${watchlist.class_filter ? 'LEFT JOIN public.trademark_classes tc ON t.id = tc.trademark_id' : ''}
        WHERE 
          t.mark_text IS NOT NULL
          AND (
            -- Exact match
            LOWER(unaccent(t.mark_text)) = LOWER(unaccent($1))
            -- Prefix match
            OR LOWER(unaccent(t.mark_text)) LIKE LOWER(unaccent($1)) || '%'
            -- Contains match
            OR LOWER(unaccent(t.mark_text)) LIKE '%' || LOWER(unaccent($1)) || '%'
            -- Full-text search
            OR t.mark_text_tsv @@ plainto_tsquery('simple', $1)
            -- Trigram similarity fallback
            OR similarity(
                LOWER(unaccent(t.mark_text)),
                LOWER(unaccent($1))
              ) > 0.15
          )
          AND t.status_norm = ANY($2)
          ${watchlist.class_filter ? 'AND tc.nice_class = ANY($3)' : ''}
        GROUP BY t.id
      )
      -- Stage 2: Re-rank with token-based scoring
      SELECT
        c.id::text,
        c.serial_number,
        c.mark_text,
        c.trgm_score AS sim_trgm,
        -- Token-based final score
        CASE 
          WHEN LOWER(unaccent(c.mark_text)) = LOWER(unaccent($1)) THEN 1.0
          ELSE token_similarity($1, c.mark_text)
        END AS sim_final,
        -- Ranking based on final score
        (
          CASE 
            WHEN LOWER(unaccent(c.mark_text)) = LOWER(unaccent($1)) THEN 1000.0
            ELSE token_similarity($1, c.mark_text) * 100.0
          END
          + ts_rank(
              to_tsvector('simple', COALESCE(c.mark_text, '')),
              plainto_tsquery('simple', $1)
            ) * 10.0
        ) AS rank
      FROM candidates c
      WHERE 
        CASE 
          WHEN LOWER(unaccent(c.mark_text)) = LOWER(unaccent($1)) THEN 1.0
          ELSE token_similarity($1, c.mark_text)
        END >= $${watchlist.class_filter ? '4' : '3'}
      ORDER BY rank DESC, sim_final DESC
      LIMIT 100
    `;

    const queryParams: any[] = [
      watchlist.query,
      statusValues,
    ];
    
    if (watchlist.class_filter) {
      queryParams.push(watchlist.class_filter);
    }
    
    queryParams.push(watchlist.min_similarity);

    // Execute search
    const results = await queryRows<TrademarkSearchResult>(searchQuery, queryParams);

    // 🔧 FIX 3: Insert new hits with ON CONFLICT DO NOTHING to prevent duplicates
    let insertedCount = 0;
    for (const hit of results) {
      try {
        const result = await query(
          `
            INSERT INTO public.watchlist_hits 
              (watchlist_id, trademark_id, trademark_serial_number, similarity_score, risk_level)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (watchlist_id, trademark_serial_number) DO NOTHING
            RETURNING id
          `,
          [
            watchlistId,
            hit.id,
            hit.serial_number,
            hit.sim_final, // Use final score for storage
            calculateRiskLevel(hit.sim_final),
          ]
        );
        // Only count if actually inserted (not a conflict)
        if (result.rowCount && result.rowCount > 0) {
          insertedCount++;
        }
      } catch (error) {
        console.error('Error inserting hit:', error);
      }
    }

    // Get total existing hits count
    const totalHitsResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM public.watchlist_hits WHERE watchlist_id = $1`,
      [watchlistId]
    );
    const totalHits = parseInt(totalHitsResult?.count || '0', 10);

    // Update last_checked_at
    await query(
      `
        UPDATE public.watchlists
        SET last_checked_at = NOW()
        WHERE id = $1
      `,
      [watchlistId]
    );

    return NextResponse.json({
      success: true,
      checked_at: new Date().toISOString(),
      total_matches: results.length,
      new_hits: insertedCount,
      existing_hits: totalHits - insertedCount,
    });

  } catch (error) {
    console.error('Watchlist check error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check watchlist',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
