import type { ReferredUserSummary } from "@/lib/types/database";

import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureProfileIfMissing } from "@/lib/ensure-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  companyName: z.string().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
});

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

    const ensured = await ensureProfileIfMissing(user, supabase);

    if (!ensured.ok) {
      return NextResponse.json({ error: ensured.error }, { status: 503 });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { data: referredRows, error: referredError } = await supabase
      .from("profiles")
      .select("id, created_at")
      .eq("referred_by_user_id", user.id)
      .order("created_at", { ascending: false });

    let referredUsers: ReferredUserSummary[] = [];

    if (!referredError && referredRows?.length) {
      const admin = createAdminClient();

      referredUsers = await Promise.all(
        referredRows.map(async (row) => {
          const { data: authUser } = await admin.auth.admin.getUserById(row.id);

          return {
            id: row.id,
            email: authUser?.user?.email ?? null,
            created_at: row.created_at,
          };
        }),
      );
    }

    const referralCount = referredUsers.length;

    return NextResponse.json({
      profile,
      referral: {
        code: profile.referral_code ?? null,
        referralCount,
        referredUsers,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const validatedData = updateProfileSchema.parse(body);

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const ensured = await ensureProfileIfMissing(user, supabase);

    if (!ensured.ok) {
      return NextResponse.json({ error: ensured.error }, { status: 503 });
    }

    const updateData: any = {};

    if (validatedData.firstName !== undefined)
      updateData.first_name = validatedData.firstName;
    if (validatedData.lastName !== undefined)
      updateData.last_name = validatedData.lastName;
    if (validatedData.companyName !== undefined)
      updateData.company_name = validatedData.companyName;
    if (validatedData.phone !== undefined)
      updateData.phone = validatedData.phone;
    if (validatedData.country !== undefined)
      updateData.country = validatedData.country;

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: "Profile updated successfully",
      profile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
