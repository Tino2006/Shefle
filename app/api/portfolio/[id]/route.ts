import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { queryOne, query } from "@/lib/db/postgres";
import { isMissingPortfolioApprovalColumn } from "@/lib/db/portfolioApprovalMigration";

const isMissingNicheClassesColumnError = (error: unknown) =>
  error instanceof Error &&
  /column\s+"?niche_classes"?\s+does not exist/i.test(error.message);

const isMissingApprovalColumnError = isMissingPortfolioApprovalColumn;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    let trademark;

    try {
      trademark = await queryOne(
        `SELECT
          id::text,
          user_id::text,
          registration_number,
          country,
          niche_class,
          COALESCE(niche_classes, ARRAY[niche_class]) AS niche_classes,
          registration_date::text,
          logo_url,
          logo_image_url,
          mark_name,
          approval_status,
          rejection_reason,
          reviewed_at::text,
          reviewed_by::text,
          created_at::text,
          updated_at::text
        FROM public.portfolio_trademarks
        WHERE id = $1 AND user_id = $2`,
        [id, user.id],
      );
    } catch (error) {
      if (isMissingNicheClassesColumnError(error)) {
        trademark = await queryOne(
          `SELECT
            id::text,
            user_id::text,
            registration_number,
            country,
            niche_class,
            ARRAY[niche_class] AS niche_classes,
            registration_date::text,
            logo_url,
            NULL::text AS logo_image_url,
            mark_name,
            'approved'::text AS approval_status,
            NULL::text AS rejection_reason,
            NULL::text AS reviewed_at,
            NULL::text AS reviewed_by,
            created_at::text,
            updated_at::text
          FROM public.portfolio_trademarks
          WHERE id = $1 AND user_id = $2`,
          [id, user.id],
        );
      } else if (isMissingApprovalColumnError(error)) {
        trademark = await queryOne(
          `SELECT
            id::text,
            user_id::text,
            registration_number,
            country,
            niche_class,
            COALESCE(niche_classes, ARRAY[niche_class]) AS niche_classes,
            registration_date::text,
            logo_url,
            NULL::text AS logo_image_url,
            mark_name,
            'approved'::text AS approval_status,
            NULL::text AS rejection_reason,
            NULL::text AS reviewed_at,
            NULL::text AS reviewed_by,
            created_at::text,
            updated_at::text
          FROM public.portfolio_trademarks
          WHERE id = $1 AND user_id = $2`,
          [id, user.id],
        );
      } else {
        throw error;
      }
    }

    if (!trademark) {
      return NextResponse.json(
        { error: "Trademark not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, trademark });
  } catch (error) {
    console.error("Get portfolio trademark error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch portfolio trademark",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const result = await query(
      `DELETE FROM public.portfolio_trademarks
      WHERE id = $1 AND user_id = $2`,
      [id, user.id],
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Trademark not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete portfolio trademark error:", error);

    return NextResponse.json(
      {
        error: "Failed to delete portfolio trademark",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
