import { NextRequest, NextResponse } from "next/server";

import { runWatchlistCheck } from "@/lib/watchlists/runWatchlistCheck";

/**
 * Watchlist Check API
 * POST /api/watchlists/[id]/check
 * Runs the watchlist search and stores new hits
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await runWatchlistCheck(id);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Watchlist not found" ? 404 : 500;

    console.error("Watchlist check error:", error);

    return NextResponse.json(
      {
        error:
          status === 404 ? "Watchlist not found" : "Failed to check watchlist",
        message,
      },
      { status },
    );
  }
}
