import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { reconcileTransaction } from "@/lib/areeba/reconcile";

export async function POST(
  _request: Request,
  context: { params: Promise<{ ref: string }> },
) {
  const { ref } = await context.params;

  if (!ref) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Ownership check before we hit Areeba — prevents anyone with a UUID from
  // forcing a reconciliation against another user's order.
  const { data: tx, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("transaction_reference", ref)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!tx) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const outcome = await reconcileTransaction(ref);
  return NextResponse.json({ outcome });
}
