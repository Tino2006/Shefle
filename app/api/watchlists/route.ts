import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryRows } from '@/lib/db/postgres';
import { z } from 'zod';

/**
 * Watchlist API
 * POST /api/watchlists - Create a new watchlist
 * GET /api/watchlists - List user's watchlists
 */

// Create watchlist schema
const createWatchlistSchema = z.object({
  query: z.string().min(2, 'Query must be at least 2 characters'),
  min_similarity: z.number().min(0).max(1).default(0.6),
  status_filter: z.string().default('ACTIVE,PENDING'),
  class_filter: z.array(z.number().int().min(1).max(45)).nullable().optional(),
});

interface Watchlist {
  id: string;
  user_id: string;
  query: string;
  min_similarity: number;
  status_filter: string;
  class_filter: number[] | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

// POST - Create new watchlist
export async function POST(request: NextRequest) {
  try {
    // For MVP, we'll use a mock user_id
    // In production, this should come from authentication
    const mockUserId = '00000000-0000-0000-0000-000000000001';

    const body = await request.json();
    const validated = createWatchlistSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validated.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const { query, min_similarity, status_filter, class_filter } = validated.data;

    // Insert watchlist
    const result = await queryOne<Watchlist>(
      `
        INSERT INTO public.watchlists 
          (user_id, query, min_similarity, status_filter, class_filter)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING 
          id::text, 
          user_id::text, 
          query, 
          min_similarity, 
          status_filter, 
          class_filter,
          last_checked_at::text,
          created_at::text,
          updated_at::text
      `,
      [mockUserId, query, min_similarity, status_filter, class_filter || null]
    );

    if (!result) {
      throw new Error('Failed to create watchlist');
    }

    return NextResponse.json({
      success: true,
      watchlist: result,
    }, { status: 201 });

  } catch (error) {
    console.error('Create watchlist error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create watchlist',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET - List user's watchlists
export async function GET(request: NextRequest) {
  try {
    // For MVP, we'll use a mock user_id
    const mockUserId = '00000000-0000-0000-0000-000000000001';

    const watchlists = await queryRows<Watchlist>(
      `
        SELECT 
          id::text,
          user_id::text,
          query,
          min_similarity,
          status_filter,
          class_filter,
          last_checked_at::text,
          created_at::text,
          updated_at::text
        FROM public.watchlists
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [mockUserId]
    );

    return NextResponse.json({
      success: true,
      watchlists,
    });

  } catch (error) {
    console.error('List watchlists error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch watchlists',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
