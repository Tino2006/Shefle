import { NextRequest, NextResponse } from 'next/server';
import { queryRows } from '@/lib/db/postgres';
import { generateCandidateQueries, deduplicateResults, rankResults } from '@/lib/queryGeneration';

/**
 * Multi-Stage Trademark Search API
 * POST /api/trademarks/multi-search
 * 
 * Body:
 * - normalizedText (required): Normalized OCR text
 * - classes (optional): Array of NICE class numbers to boost
 * - limit (optional): Max results per candidate query (default 25)
 */

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
  owner_country: string | null;
  sim_trgm: number;
  sim_final: number;
  rank: number;
  classes: number[] | null;
  candidate_query: string;
}

interface TrademarkResult {
  serial_number: string;
  office: string;
  registration_number: string | null;
  mark_text: string | null;
  status_norm: string | null;
  owner_name: string | null;
  owner_country: string | null;
  filing_date: string | null;
  classes: number[];
  sim_trgm: number;
  sim_final: number;
  similarity_score: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
  matched_candidate: string;
}

interface MultiSearchResponse {
  candidates: string[];
  count: number;
  results: TrademarkResult[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { normalizedText, classes, limit = 25 } = body;

    if (!normalizedText || typeof normalizedText !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid normalizedText parameter' },
        { status: 400 }
      );
    }

    // Generate candidate queries
    const candidates = generateCandidateQueries(normalizedText);

    if (candidates.length === 0) {
      return NextResponse.json({
        candidates: [],
        count: 0,
        results: [],
      });
    }

    // Parse classes if provided
    let classNumbers: number[] | null = null;
    if (classes && Array.isArray(classes)) {
      classNumbers = classes
        .map(c => parseInt(String(c), 10))
        .filter(n => !isNaN(n) && n >= 1 && n <= 45);
    }

    // Run search for each candidate
    const allResults: TrademarkResult[] = [];
    const statusValues = ['ACTIVE', 'PENDING', 'DEAD'];

    for (const candidate of candidates) {
      // Build SQL query with hybrid retrieval/ranking
      const sqlQuery = `
        WITH candidates AS (
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
            t.owner_country,
            similarity(
              LOWER(unaccent(COALESCE(t.mark_text, ''))),
              LOWER(unaccent($1))
            ) AS trgm_score,
            similarity(
              LOWER(unaccent(REPLACE(COALESCE(t.mark_text, ''), ' ', ''))),
              LOWER(unaccent(REPLACE($1, ' ', '')))
            ) AS trgm_nospace_score
          FROM public.trademarks t
          LEFT JOIN public.trademark_classes tc ON t.id = tc.trademark_id
          WHERE 
            t.mark_text IS NOT NULL
            AND (
              LOWER(unaccent(t.mark_text)) = LOWER(unaccent($1))
              OR LOWER(unaccent(t.mark_text)) LIKE LOWER(unaccent($1)) || '%'
              OR LOWER(unaccent(t.mark_text)) LIKE '%' || LOWER(unaccent($1)) || '%'
              OR t.mark_text_tsv @@ plainto_tsquery('simple', $1)
              OR similarity(
                  LOWER(unaccent(t.mark_text)),
                  LOWER(unaccent($1))
                ) > 0.15
              OR dmetaphone(LOWER(unaccent(t.mark_text))) = dmetaphone(LOWER(unaccent($1)))
              OR dmetaphone_alt(LOWER(unaccent(t.mark_text))) = dmetaphone_alt(LOWER(unaccent($1)))
              OR similarity(
                  LOWER(unaccent(REPLACE(t.mark_text, ' ', ''))),
                  LOWER(unaccent(REPLACE($1, ' ', '')))
                ) > 0.2
            )
            AND t.status_norm = ANY($3)
          GROUP BY t.id
        )
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
          c.owner_country,
          c.trgm_score AS sim_trgm,
          CASE 
            WHEN LOWER(unaccent(c.mark_text)) = LOWER(unaccent($1)) THEN 1.0
            ELSE trademark_similarity_v2($1, c.mark_text, c.trgm_score::numeric)
          END AS sim_final,
          (
            CASE 
              WHEN LOWER(unaccent(c.mark_text)) = LOWER(unaccent($1)) THEN 1000.0
              ELSE trademark_similarity_v2($1, c.mark_text, c.trgm_score::numeric) * 100.0
            END
            + ts_rank(
                to_tsvector('simple', COALESCE(c.mark_text, '')),
                plainto_tsquery('simple', $1)
              ) * 10.0
            + c.trgm_nospace_score * 5.0
          ) AS rank,
          COALESCE(
            (
              SELECT ARRAY_AGG(DISTINCT tc2.nice_class ORDER BY tc2.nice_class)
              FROM public.trademark_classes tc2
              WHERE tc2.trademark_id = c.id
            ),
            ARRAY[]::integer[]
          ) AS classes,
          $1::text AS candidate_query
        FROM candidates c
        WHERE
          CASE
            WHEN LOWER(unaccent(c.mark_text)) = LOWER(unaccent($1)) THEN 1.0
            ELSE trademark_similarity_v2($1, c.mark_text, c.trgm_score::numeric)
          END >= 0.4
        ORDER BY rank DESC, sim_final DESC
        LIMIT $2
      `;

      const queryParams: any[] = [candidate, limit, statusValues];

      try {
        const rows = await queryRows<TrademarkRow>(sqlQuery, queryParams);

        // Transform and add to results
        rows.forEach(row => {
          const simTrgm = typeof row.sim_trgm === 'number' ? row.sim_trgm : parseFloat(String(row.sim_trgm || 0));
          const simFinal = typeof row.sim_final === 'number' ? row.sim_final : parseFloat(String(row.sim_final || 0));

          allResults.push({
            serial_number: row.serial_number,
            office: row.office,
            registration_number: row.registration_number,
            mark_text: row.mark_text,
            status_norm: row.status_norm,
            owner_name: row.owner_name,
            owner_country: row.owner_country,
            filing_date: row.filing_date,
            classes: row.classes || [],
            sim_trgm: parseFloat(simTrgm.toFixed(3)),
            sim_final: parseFloat(simFinal.toFixed(3)),
            similarity_score: parseFloat(simFinal.toFixed(3)),
            risk_level: calculateRiskLevel(simFinal),
            matched_candidate: candidate,
          });
        });
      } catch (err) {
        console.error(`Error searching for candidate "${candidate}":`, err);
      }
    }

    // Deduplicate by (office, serial_number), keeping max similarity
    const dedupedResults = deduplicateResults(allResults);

    // Rank results with custom logic
    const rankedResults = rankResults(dedupedResults, classNumbers || undefined);

    return NextResponse.json({
      candidates,
      count: rankedResults.length,
      results: rankedResults,
    });

  } catch (error) {
    console.error('Multi-search error:', error);

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

function calculateRiskLevel(simFinal: number): 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW' {
  if (simFinal >= 0.8) return 'HIGH';
  if (simFinal >= 0.6) return 'MEDIUM';
  if (simFinal >= 0.4) return 'LOW';
  return 'VERY_LOW';
}
