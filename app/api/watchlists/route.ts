import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { queryOne, queryRows } from "@/lib/db/postgres";

/**
 * Watchlist API
 * POST /api/watchlists - Create a new watchlist
 * GET /api/watchlists - List user's watchlists
 */

const createWatchlistSchema = z.object({
  query: z.string().min(2, "Query must be at least 2 characters"),
  image_base64: z.string().nullable().optional(),
  min_similarity: z.number().min(0).max(1).default(0.6),
  status_filter: z.string().default("ACTIVE,PENDING"),
  class_filter: z.array(z.number().int().min(1).max(45)).nullable().optional(),
  portfolio_trademark_id: z.number().int().positive().nullable().optional(),
});

interface Watchlist {
  id: string;
  user_id: string;
  query: string;
  has_image: boolean;
  min_similarity: number;
  status_filter: string;
  class_filter: number[] | null;
  portfolio_trademark_id: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PortfolioTrademarkLogoRow {
  id: string;
  logo_url: string | null;
  approval_status: string;
}

interface ExistingWatchlistRow {
  id: string;
}

async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.startsWith("image/")) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      return null;
    }

    return Buffer.from(arrayBuffer).toString("base64");
  } catch (error) {
    console.warn(
      "Failed to fetch portfolio logo for visual monitoring:",
      error,
    );

    return null;
  }
}

// POST - Create new watchlist
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createWatchlistSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validated.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const {
      query,
      image_base64,
      min_similarity,
      status_filter,
      class_filter,
      portfolio_trademark_id,
    } = validated.data;
    let resolvedImageBase64 = image_base64 || null;

    // Prevent duplicate monitors for the same user
    const existingWatchlist = portfolio_trademark_id
      ? await queryOne<ExistingWatchlistRow>(
          `
            SELECT id::text
            FROM public.watchlists
            WHERE user_id = $1
              AND portfolio_trademark_id = $2
            LIMIT 1
          `,
          [user.id, portfolio_trademark_id],
        )
      : await queryOne<ExistingWatchlistRow>(
          `
            SELECT id::text
            FROM public.watchlists
            WHERE user_id = $1
              AND LOWER(unaccent(query)) = LOWER(unaccent($2))
            LIMIT 1
          `,
          [user.id, query],
        );

    if (existingWatchlist) {
      return NextResponse.json(
        {
          error: "Monitor already exists",
          message: "You already have a monitor for this trademark.",
        },
        { status: 409 },
      );
    }

    if (portfolio_trademark_id) {
      const portfolioTrademark = await queryOne<PortfolioTrademarkLogoRow>(
        `
          SELECT id::text, logo_url, COALESCE(approval_status, 'approved') AS approval_status
          FROM public.portfolio_trademarks
          WHERE id = $1 AND user_id = $2
        `,
        [portfolio_trademark_id, user.id],
      );

      if (!portfolioTrademark) {
        return NextResponse.json(
          { error: "Invalid portfolio trademark selection" },
          { status: 403 },
        );
      }

      if (portfolioTrademark.approval_status !== "approved") {
        return NextResponse.json(
          {
            error: "Trademark not approved",
            message:
              "This trademark is pending admin approval or was rejected. You can create a monitor only after it is approved.",
          },
          { status: 403 },
        );
      }

      if (!resolvedImageBase64 && portfolioTrademark.logo_url) {
        resolvedImageBase64 = await fetchImageAsBase64(
          portfolioTrademark.logo_url,
        );
      }
    }

    const result = await queryOne<Watchlist>(
      `
        INSERT INTO public.watchlists 
          (user_id, query, image_base64, min_similarity, status_filter, class_filter, portfolio_trademark_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING 
          id::text, 
          user_id::text, 
          query, 
          (image_base64 IS NOT NULL) AS has_image,
          min_similarity, 
          status_filter, 
          class_filter,
          portfolio_trademark_id::text,
          last_checked_at::text,
          created_at::text,
          updated_at::text
      `,
      [
        user.id,
        query,
        resolvedImageBase64,
        min_similarity,
        status_filter,
        class_filter || null,
        portfolio_trademark_id || null,
      ],
    );

    if (!result) {
      throw new Error("Failed to create watchlist");
    }

    return NextResponse.json(
      {
        success: true,
        watchlist: result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create watchlist error:", error);

    return NextResponse.json(
      {
        error: "Failed to create watchlist",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// GET - List user's watchlists
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const watchlists = await queryRows<Watchlist>(
      `
        SELECT 
          id::text,
          user_id::text,
          query,
          (image_base64 IS NOT NULL) AS has_image,
          min_similarity,
          status_filter,
          class_filter,
          portfolio_trademark_id::text,
          last_checked_at::text,
          created_at::text,
          updated_at::text
        FROM public.watchlists
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [user.id],
    );

    return NextResponse.json({
      success: true,
      watchlists,
    });
  } catch (error) {
    console.error("List watchlists error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch watchlists",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
