import type { AdminPortfolioTrademarkRow } from "@/lib/types/database";

import { NextResponse } from "next/server";

import { verifyAdminApi, isErrorResponse } from "@/lib/api-middleware";
import { queryRows } from "@/lib/db/postgres";
import { isMissingPortfolioApprovalColumn } from "@/lib/db/portfolioApprovalMigration";

export async function GET(request: Request) {
  try {
    const authResult = await verifyAdminApi();

    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    if (!["pending", "approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status filter" },
        { status: 400 },
      );
    }

    const trademarks = await queryRows<AdminPortfolioTrademarkRow>(
      `
        SELECT
          pt.id::text,
          pt.user_id::text,
          pt.registration_number,
          pt.country,
          pt.niche_class,
          COALESCE(pt.niche_classes, ARRAY[pt.niche_class]) AS niche_classes,
          pt.registration_date::text,
          pt.logo_url,
          pt.mark_name,
          pt.approval_status,
          pt.rejection_reason,
          pt.reviewed_at::text,
          pt.reviewed_by::text,
          pt.created_at::text,
          pt.updated_at::text,
          p.first_name AS owner_first_name,
          p.last_name AS owner_last_name
        FROM public.portfolio_trademarks pt
        LEFT JOIN public.profiles p ON p.id = pt.user_id
        WHERE pt.approval_status = $1
        ORDER BY pt.created_at DESC
      `,
      [status],
    );

    return NextResponse.json({ trademarks });
  } catch (error) {
    if (isMissingPortfolioApprovalColumn(error)) {
      return NextResponse.json(
        {
          error: "Database migration required",
          message:
            "Add approval columns to portfolio_trademarks: run portfolio-schema.sql (end section) or portfolio-trademark-approval.sql after supabase-rbac-migration.sql.",
        },
        { status: 503 },
      );
    }
    console.error("Admin portfolio trademarks error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
