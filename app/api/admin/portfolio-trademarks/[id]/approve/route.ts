import { NextResponse } from "next/server";

import { verifyAdminApi, isErrorResponse } from "@/lib/api-middleware";
import { query } from "@/lib/db/postgres";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await verifyAdminApi();

    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { user } = authResult;
    const { id } = await params;

    const result = await query(
      `
        UPDATE public.portfolio_trademarks
        SET
          approval_status = 'approved',
          rejection_reason = NULL,
          reviewed_at = NOW(),
          reviewed_by = $2::uuid
        WHERE id = $1::bigint
      `,
      [id, user.id],
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Trademark not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: "Trademark approved successfully" });
  } catch (error) {
    console.error("Approve portfolio trademark error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
