import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { queryOne, queryRows } from "@/lib/db/postgres";
import { isMissingPortfolioApprovalColumn } from "@/lib/db/portfolioApprovalMigration";

const createPortfolioTrademarkSchema = z.object({
  registration_number: z.string().min(1, "Registration number is required"),
  country: z.string().min(1, "Country is required"),
  niche_classes: z
    .array(z.number().int().min(1).max(45))
    .min(1, "At least one niche class is required"),
  registration_date: z.string().min(1, "Registration date is required"),
  logo_url: z.string().min(1, "Certificate upload is required"),
  mark_name: z.string().min(1, "Mark name is required"),
});

const isMissingNicheClassesColumnError = (error: unknown) =>
  error instanceof Error &&
  /column\s+"?niche_classes"?\s+does not exist/i.test(error.message);

const isMissingApprovalColumnError = isMissingPortfolioApprovalColumn;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let trademarks;

    try {
      trademarks = await queryRows(
        `SELECT
          id::text,
          user_id::text,
          registration_number,
          country,
          niche_class,
          COALESCE(niche_classes, ARRAY[niche_class]) AS niche_classes,
          registration_date::text,
          logo_url,
          mark_name,
          approval_status,
          rejection_reason,
          reviewed_at::text,
          reviewed_by::text,
          created_at::text,
          updated_at::text
        FROM public.portfolio_trademarks
        WHERE user_id = $1
        ORDER BY created_at DESC`,
        [user.id],
      );
    } catch (error) {
      if (isMissingNicheClassesColumnError(error)) {
        trademarks = await queryRows(
          `SELECT
            id::text,
            user_id::text,
            registration_number,
            country,
            niche_class,
            ARRAY[niche_class] AS niche_classes,
            registration_date::text,
            logo_url,
            mark_name,
            'approved'::text AS approval_status,
            NULL::text AS rejection_reason,
            NULL::text AS reviewed_at,
            NULL::text AS reviewed_by,
            created_at::text,
            updated_at::text
          FROM public.portfolio_trademarks
          WHERE user_id = $1
          ORDER BY created_at DESC`,
          [user.id],
        );
      } else if (isMissingApprovalColumnError(error)) {
        trademarks = await queryRows(
          `SELECT
            id::text,
            user_id::text,
            registration_number,
            country,
            niche_class,
            COALESCE(niche_classes, ARRAY[niche_class]) AS niche_classes,
            registration_date::text,
            logo_url,
            mark_name,
            'approved'::text AS approval_status,
            NULL::text AS rejection_reason,
            NULL::text AS reviewed_at,
            NULL::text AS reviewed_by,
            created_at::text,
            updated_at::text
          FROM public.portfolio_trademarks
          WHERE user_id = $1
          ORDER BY created_at DESC`,
          [user.id],
        );
      } else {
        throw error;
      }
    }

    return NextResponse.json({ success: true, trademarks });
  } catch (error) {
    console.error("List portfolio trademarks error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch portfolio trademarks",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

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
    const validated = createPortfolioTrademarkSchema.safeParse(body);

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

    const nicheClasses = Array.from(new Set(validated.data.niche_classes)).sort(
      (a, b) => a - b,
    );
    const primaryClass = nicheClasses[0];
    const {
      registration_number,
      country,
      registration_date,
      logo_url,
      mark_name,
    } = validated.data;

    let result;

    try {
      result = await queryOne(
        `INSERT INTO public.portfolio_trademarks
          (user_id, registration_number, country, niche_class, niche_classes, registration_date, logo_url, mark_name, approval_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        RETURNING
          id::text,
          user_id::text,
          registration_number,
          country,
          niche_class,
          COALESCE(niche_classes, ARRAY[niche_class]) AS niche_classes,
          registration_date::text,
          logo_url,
          mark_name,
          approval_status,
          rejection_reason,
          reviewed_at::text,
          reviewed_by::text,
          created_at::text,
          updated_at::text`,
        [
          user.id,
          registration_number,
          country,
          primaryClass,
          nicheClasses,
          registration_date,
          logo_url,
          mark_name,
        ],
      );
    } catch (error) {
      if (isMissingNicheClassesColumnError(error)) {
        result = await queryOne(
          `INSERT INTO public.portfolio_trademarks
            (user_id, registration_number, country, niche_class, registration_date, logo_url, mark_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING
            id::text,
            user_id::text,
            registration_number,
            country,
            niche_class,
            ARRAY[niche_class] AS niche_classes,
            registration_date::text,
            logo_url,
            mark_name,
            'approved'::text AS approval_status,
            NULL::text AS rejection_reason,
            NULL::text AS reviewed_at,
            NULL::text AS reviewed_by,
            created_at::text,
            updated_at::text`,
          [
            user.id,
            registration_number,
            country,
            primaryClass,
            registration_date,
            logo_url,
            mark_name,
          ],
        );
      } else if (isMissingApprovalColumnError(error)) {
        result = await queryOne(
          `INSERT INTO public.portfolio_trademarks
            (user_id, registration_number, country, niche_class, niche_classes, registration_date, logo_url, mark_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING
            id::text,
            user_id::text,
            registration_number,
            country,
            niche_class,
            COALESCE(niche_classes, ARRAY[niche_class]) AS niche_classes,
            registration_date::text,
            logo_url,
            mark_name,
            'approved'::text AS approval_status,
            NULL::text AS rejection_reason,
            NULL::text AS reviewed_at,
            NULL::text AS reviewed_by,
            created_at::text,
            updated_at::text`,
          [
            user.id,
            registration_number,
            country,
            primaryClass,
            nicheClasses,
            registration_date,
            logo_url,
            mark_name,
          ],
        );
      } else {
        throw error;
      }
    }

    if (!result) {
      throw new Error("Failed to create portfolio trademark");
    }

    return NextResponse.json(
      { success: true, trademark: result },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create portfolio trademark error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const isDuplicate = message.includes("idx_portfolio_trademarks_user_reg");

    return NextResponse.json(
      {
        error: isDuplicate
          ? "You already have a trademark with this registration number"
          : "Failed to create portfolio trademark",
        message,
      },
      { status: isDuplicate ? 409 : 500 },
    );
  }
}
