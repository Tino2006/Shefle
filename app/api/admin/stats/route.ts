import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { verifyAdminApi, isErrorResponse } from "@/lib/api-middleware";
import { queryOne } from "@/lib/db/postgres";
import { isMissingPortfolioApprovalColumn } from "@/lib/db/portfolioApprovalMigration";

export async function GET() {
  try {
    // Verify admin access
    const authResult = await verifyAdminApi();

    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const supabase = await createClient();

    // Get stats
    const [
      usersResult,
      brandsResult,
      pendingBrandsResult,
      contactsResult,
      unreadContactsResult,
      subscriptionsResult,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("brands").select("id", { count: "exact", head: true }),
      supabase
        .from("brands")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("contact_submissions")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("contact_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

    let pendingPortfolioTrademarks = 0;

    try {
      const row = await queryOne<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM public.portfolio_trademarks WHERE approval_status = 'pending'`,
      );

      pendingPortfolioTrademarks = parseInt(row?.c || "0", 10) || 0;
    } catch (e) {
      if (!isMissingPortfolioApprovalColumn(e)) {
        console.warn(
          "Admin stats: pending portfolio trademark count failed:",
          e,
        );
      }
      pendingPortfolioTrademarks = 0;
    }

    const stats = {
      totalUsers: usersResult.count || 0,
      totalBrands: brandsResult.count || 0,
      pendingBrands: pendingBrandsResult.count || 0,
      pendingPortfolioTrademarks,
      totalContacts: contactsResult.count || 0,
      unreadContacts: unreadContactsResult.count || 0,
      activeSubscriptions: subscriptionsResult.count || 0,
      totalRevenue: 0, // You can calculate this from transactions
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Admin stats error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
