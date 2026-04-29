import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(
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

  // Ownership check is explicit (don't rely solely on RLS).
  const { data, error } = await supabase
    .from("transactions")
    .select("status, amount, currency, provider, transaction_reference")
    .eq("transaction_reference", ref)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: data.status,
    amount: data.amount,
    currency: data.currency,
    provider: data.provider,
    transactionReference: data.transaction_reference,
  });
}
