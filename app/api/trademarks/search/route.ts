import { NextRequest, NextResponse } from "next/server";

import { queryRows } from "@/lib/db/postgres";
import { searchIPAustralia } from "@/lib/ipaustralia/search";
import { searchEUIPO } from "@/lib/euipo/search";
import { createClient } from "@/lib/supabase/server";
import { checkQuota, incrementUsage } from "@/lib/subscriptions/usage";

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
  owner_country: string | null;
  sim_trgm: number;
  sim_final: number;
  rank: number;
  classes: number[] | null;
}

// Response type
interface TrademarkResult {
  office: string;
  serial_number: string;
  registration_number: string | null;
  mark_text: string | null;
  status_norm: string | null;
  owner_name: string | null;
  owner_country: string | null;
  filing_date: string | null;
  classes: number[];
  sim_trgm: number;
  sim_final: number;
  similarity_score: number; // Legacy field (uses sim_final)
  risk_level: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
}

interface SearchResponse {
  query: string;
  count: number;
  results: TrademarkResult[];
  warnings?: string[];
}

export async function GET(request: NextRequest) {
  try {
    // 🔧 FIX 2: Defensive query param parsing - never assume params exist
    const searchParams = request.nextUrl.searchParams;

    const query = searchParams.get("query")?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "Missing query parameter" },
        { status: 400 },
      );
    }

    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const status = searchParams.get("status") || "ACTIVE,PENDING";
    const classes = searchParams.get("classes") || null;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          error: "Invalid limit parameter",
          message: "Limit must be between 1 and 100",
        },
        { status: 400 },
      );
    }

    // Default status filter: ACTIVE,PENDING unless explicitly requested
    const statusValues = status
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => ["ACTIVE", "PENDING", "DEAD"].includes(s));

    if (statusValues.length === 0) {
      return NextResponse.json(
        {
          error: "Invalid status parameter",
          message:
            "Status must be one or more of: ACTIVE, PENDING, DEAD (comma-separated)",
        },
        { status: 400 },
      );
    }

    // Parse classes if provided and non-empty
    let classNumbers: number[] | null = null;

    if (classes && classes.trim()) {
      classNumbers = classes
        .split(",")
        .map((c) => parseInt(c.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 1 && n <= 45);

      if (classNumbers.length === 0) {
        return NextResponse.json(
          {
            error: "Invalid classes parameter",
            message: "Classes must be comma-separated numbers between 1 and 45",
          },
          { status: 400 },
        );
      }
    }

    // Subscription quota: if the user is logged in, gate searches by their
    // plan's searches_limit. Anonymous callers fall through (public search
    // remains unmetered for now).
    let authedUserId: string | null = null;

    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        authedUserId = user.id;
        const quota = await checkQuota(
          supabase,
          user.id,
          "searches_used",
          "searches_limit",
        );

        if (!quota.allowed && quota.reason === "limit_reached") {
          return NextResponse.json(
            {
              error: "search_limit_reached",
              message:
                "You've reached your monthly search limit. Upgrade your plan to continue searching.",
              limit: quota.limit,
              used: quota.used,
              remaining: 0,
            },
            { status: 403 },
          );
        }
      }
    } catch (quotaErr) {
      // Never block search on a quota-system error — log and continue.
      console.error("[search] quota check failed:", quotaErr);
    }

    // Hybrid similarity retrieval/ranking:
    // Stage 1: lexical + phonetic + compound-word candidate retrieval
    // Stage 2: weighted multi-signal score via trademark_similarity_v2()
    const sqlQuery = `
      WITH candidates AS (
        -- Stage 1: broad retrieval net
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
            -- Phonetic gates (captures NIKE/NIKKE, KLEAN/CLEAN)
            OR dmetaphone(LOWER(unaccent(t.mark_text))) = dmetaphone(LOWER(unaccent($1)))
            OR dmetaphone_alt(LOWER(unaccent(t.mark_text))) = dmetaphone_alt(LOWER(unaccent($1)))
            -- Compound-word gate (captures LIGHT BOX/LIGHTBOX)
            OR similarity(
                LOWER(unaccent(REPLACE(t.mark_text, ' ', ''))),
                LOWER(unaccent(REPLACE($1, ' ', '')))
              ) > 0.2
          )
          AND t.status_norm = ANY($3)
          ${classNumbers ? `AND tc.nice_class = ANY($4)` : ""}
        GROUP BY t.id
      )
      -- Stage 2: Re-rank with weighted multi-signal scoring
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
        -- Weighted multi-signal final score
        CASE 
          WHEN LOWER(unaccent(c.mark_text)) = LOWER(unaccent($1)) THEN 1.0
          ELSE trademark_similarity_v2($1, c.mark_text, c.trgm_score::numeric)
        END AS sim_final,
        -- Ranking based on final score
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
        ) AS classes
      FROM candidates c
      WHERE
        CASE
          WHEN LOWER(unaccent(c.mark_text)) = LOWER(unaccent($1)) THEN 1.0
          ELSE trademark_similarity_v2($1, c.mark_text, c.trgm_score::numeric)
        END >= 0.45
      ORDER BY rank DESC, sim_final DESC
      LIMIT $2
    `;

    // Build parameters array
    const queryParams: any[] = [query, limit, statusValues];

    if (classNumbers) {
      queryParams.push(classNumbers);
    }

    // Function to calculate risk level based on final similarity score
    const calculateRiskLevel = (
      simFinal: number,
    ): "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW" => {
      if (simFinal >= 0.8) return "HIGH";
      if (simFinal >= 0.6) return "MEDIUM";
      if (simFinal >= 0.45) return "LOW";

      return "VERY_LOW";
    };

    const usptoPromise = queryRows<TrademarkRow>(sqlQuery, queryParams).then(
      (rows) =>
        rows.map((row): TrademarkResult => {
          const simTrgm =
            typeof row.sim_trgm === "number"
              ? row.sim_trgm
              : parseFloat(String(row.sim_trgm || 0));
          const simFinal =
            typeof row.sim_final === "number"
              ? row.sim_final
              : parseFloat(String(row.sim_final || 0));

          return {
            office: row.office,
            serial_number: row.serial_number,
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
          };
        }),
    );

    const ipAuPromise = searchIPAustralia(query, {
      maxDetails: 10,
      statusFilters: statusValues as Array<"ACTIVE" | "PENDING" | "DEAD">,
    });

    const euipoPromise = searchEUIPO(query, {
      maxResults: 10,
      statusFilters: statusValues as Array<"ACTIVE" | "PENDING" | "DEAD">,
    });

    const [usptoResult, ipAuResult, euipoResult] = await Promise.allSettled([
      usptoPromise,
      ipAuPromise,
      euipoPromise,
    ]);
    const warnings: string[] = [];

    const usptoResults =
      usptoResult.status === "fulfilled" ? usptoResult.value : [];

    if (usptoResult.status === "rejected") {
      throw usptoResult.reason;
    }

    const ipAuResults =
      ipAuResult.status === "fulfilled" ? ipAuResult.value : [];

    if (ipAuResult.status === "rejected") {
      console.error("IP Australia search error:", ipAuResult.reason);
      warnings.push("IP Australia search is temporarily unavailable.");
    }

    const euipoResults =
      euipoResult.status === "fulfilled" ? euipoResult.value : [];

    if (euipoResult.status === "rejected") {
      console.error("EUIPO search error:", euipoResult.reason);
      warnings.push("EUIPO search is temporarily unavailable.");
    }

    const merged = [...usptoResults, ...ipAuResults, ...euipoResults];
    const dedupedMap = new Map<string, TrademarkResult>();

    for (const result of merged) {
      const key = `${result.office}-${result.serial_number}`;
      const existing = dedupedMap.get(key);

      if (!existing || result.similarity_score > existing.similarity_score) {
        dedupedMap.set(key, result);
      }
    }

    const results = Array.from(dedupedMap.values())
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);

    // Count this as one search against the user's plan (fire-and-forget;
    // failures are logged inside incrementUsage and never block the response).
    if (authedUserId) {
      void incrementUsage(authedUserId, "searches_used", 1);
    }

    // Return response
    const response: SearchResponse = {
      query: query,
      count: results.length,
      results,
      ...(warnings.length > 0 ? { warnings } : {}),
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        // Authed searches must hit the function every time so usage is counted.
        // Anonymous searches can still be CDN-cached.
        "Cache-Control": authedUserId
          ? "private, no-store"
          : "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Trademark search error:", error);

    // Check for database connection errors
    if (error instanceof Error) {
      if (error.message.includes("DATABASE_URL")) {
        return NextResponse.json(
          {
            error: "Database configuration error",
            message:
              "DATABASE_URL is not configured. Please check your environment variables.",
          },
          { status: 500 },
        );
      }

      if (
        error.message.includes("connect") ||
        error.message.includes("ECONNREFUSED")
      ) {
        return NextResponse.json(
          {
            error: "Database connection error",
            message:
              "Unable to connect to the database. Please check your database configuration.",
          },
          { status: 503 },
        );
      }
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred while searching trademarks.",
      },
      { status: 500 },
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
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    },
  );
}
