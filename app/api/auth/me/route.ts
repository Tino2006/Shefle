import { NextResponse } from "next/server";

import { ensureProfileIfMissing } from "@/lib/ensure-profile";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const ensured = await ensureProfileIfMissing(user, supabase);

    if (!ensured.ok) {
      return NextResponse.json({ error: ensured.error }, { status: 503 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
