import { NextRequest, NextResponse } from 'next/server';
import { queryRows } from '@/lib/db/postgres';

/**
 * USPTO Trademark Search API
 * GET /api/trademarks/search
 * 
 * Query Parameters:
 * - query (required): Search term (min 2 characters)
 * - limit (optional): Number of results (default 25, max 100)
 * - status (optional): Comma-separated status values (default: ACTIVE,PENDING)
 * - classes (optional): Comma-separated NICE class numbers (e.g., "5,30")
 */

// Database row type
interface TrademarkRow {
  id: string;
  office: string;
  serial_number: string;
  registration_number: string | null;
  mark_text: string | null;
  status_norm: string | null;
  filing_date: string | null;
  registration_date: string | null;
  owner_name: string | null;
  sim_trgm: number;
  sim_final: number;
  rank: number;
  classes: number[] | null;
}

// Response type
interface TrademarkResult {
  serial_number: string;
  registration_number: string | null;
  mark_text: string | null;
  status_norm: string | null;
  owner_name: string | null;
  filing_date: string | null;
  classes: number[];
  sim_trgm: number;
  sim_final: number;
  similarity_score: number; // Legacy field (uses sim_final)
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
}

interface SearchResponse {
  query: string;
  count: number;
  results: TrademarkResult[];
}

export async function GET(request: NextRequest) {
  try {
    // 🔧 FIX 2: Defensive query param parsing - never assume params exist
    const searchParams = request.nextUrl.searchParams;
    
    const query = searchParams.get("query")?.trim();
    if (!query) {
      return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
    }

    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const status = searchParams.get("status") || "ACTIVE,PENDING";
    const classes = searchParams.get("classes") || null;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Invalid limit parameter", message: "Limit must be between 1 and 100" },
        { status: 400 }
      );
    }

    // Default status filter: ACTIVE,PENDING unless explicitly requested
    const statusValues = status.split(',').map(s => s.trim().toUpperCase()).filter(s => ['ACTIVE', 'PENDING', 'DEAD'].includes(s));
    
    if (statusValues.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid status parameter',
          message: 'Status must be one or more of: ACTIVE, PENDING, DEAD (comma-separated)',
        },
        { status: 400 }
      );
    }

    // Parse classes if provided and non-empty
    let classNumbers: number[] | null = null;
    if (classes && classes.trim()) {
      classNumbers = classes
        .split(',')
        .map(c => parseInt(c.trim(), 10))
        .filter(n => !isNaN(n) && n >= 1 && n <= 45);
      
      if (classNumbers.length === 0) {
        return NextResponse.json(
          {
            error: 'Invalid classes parameter',
            message: 'Classes must be comma-separated numbers between 1 and 45',
          },
          { status: 400 }
        );
      }
    }

    // 🎯 TWO-STAGE SIMILARITY: Trigram for candidates, Token-based for final ranking
    // Build the search query with two-stage scoring
    const sqlQuery = `
      WITH candidates AS (
        -- Stage 1: Use trigram for candidate selection (broad net)
        SELECT
          t.id,
          t.office,
          t.serial_number,
          t.registration_number,
          t.mark_text,
          t.status_norm,
          t.filing_date::text,
          t.registration_date::text,
          t.owner_name,
          similarity(
            LOWER(unaccent(COALESCE(t.mark_text, ''))),
            LOWER(unaccent($1))
          ) AS trgm_score
        FROM public.trademarks t
        LEFT JOIN public.trademark_classes tc ON t.id = tc.trademark_id
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
          AND t.status_norm = ANY($3)
          ${classNumbers ? `AND tc.nice_class = ANY($4)` : ''}
        GROUP BY t.id
      )
      -- Stage 2: Re-rank with token-based scoring
      SELECT
        c.id::text,
        c.office,
        c.serial_number,
        c.registration_number,
        c.mark_text,
        c.status_norm,
        c.filing_date,
        c.registration_date,
        c.owner_name,
        c.trgm_score AS sim_trgm,
        -- Token-based final score (deflates inflated scores)
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
        ) AS rank,
        COALESCE(
          (
            SELECT ARRAY_AGG(DISTINCT tc2.nice_class ORDER BY tc2.nice_class)
            FROM public.trademark_classes tc2
            WHERE tc2.trademark_id = c.id
          ),
          ARRAY[]::integer[]
        ) AS classes
      FROM candidates c
      ORDER BY rank DESC, sim_final DESC
      LIMIT $2
    `;

    // Build parameters array
    const queryParams: any[] = [query, limit, statusValues];
    if (classNumbers) {
      queryParams.push(classNumbers);
    }

    // Execute query
    const rows = await queryRows<TrademarkRow>(sqlQuery, queryParams);

    // Function to calculate risk level based on final similarity score
    const calculateRiskLevel = (simFinal: number): 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW' => {
      if (simFinal >= 0.8) return 'HIGH';
      if (simFinal >= 0.6) return 'MEDIUM';
      if (simFinal >= 0.4) return 'LOW';
      return 'VERY_LOW';
    };

    // Transform results to API response format
    const results: TrademarkResult[] = rows.map(row => {
      // Safely parse numeric values (they come back as strings from pg)
      const simTrgm = typeof row.sim_trgm === 'number' ? row.sim_trgm : parseFloat(String(row.sim_trgm || 0));
      const simFinal = typeof row.sim_final === 'number' ? row.sim_final : parseFloat(String(row.sim_final || 0));

      return {
        serial_number: row.serial_number,
        registration_number: row.registration_number,
        mark_text: row.mark_text,
        status_norm: row.status_norm,
        owner_name: row.owner_name,
        filing_date: row.filing_date,
        classes: row.classes || [],
        sim_trgm: parseFloat(simTrgm.toFixed(3)),
        sim_final: parseFloat(simFinal.toFixed(3)),
        similarity_score: parseFloat(simFinal.toFixed(3)), // Legacy field uses final score
        risk_level: calculateRiskLevel(simFinal),
      };
    });

    // Return response
    const response: SearchResponse = {
      query: query,
      count: results.length,
      results,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error) {
    console.error('Trademark search error:', error);

    // Check for database connection errors
    if (error instanceof Error) {
      if (error.message.includes('DATABASE_URL')) {
        return NextResponse.json(
          {
            error: 'Database configuration error',
            message: 'DATABASE_URL is not configured. Please check your environment variables.',
          },
          { status: 500 }
        );
      }

      if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          {
            error: 'Database connection error',
            message: 'Unable to connect to the database. Please check your database configuration.',
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred while searching trademarks.',
      },
      { status: 500 }
    );
  }
}

// Optional: Add OPTIONS handler for CORS if needed
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}
