import { createAdminClient } from "@/lib/supabase/admin";

const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Normalize user input: uppercase, trim, non-alphanumerics removed. */
export function normalizeReferralCode(
  input: string | null | undefined,
): string | null {
  if (input == null || typeof input !== "string") return null;
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (cleaned.length < 4 || cleaned.length > 32) return null;

  return cleaned;
}

export async function getUserByReferralCode(code: string) {
  const normalized = normalizeReferralCode(code);

  if (!normalized) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, referral_code")
    .eq("referral_code", normalized)
    .maybeSingle();

  if (error || !data) return null;

  return data as { id: string; referral_code: string };
}

/** App-side generator (DB trigger is primary); retries until unique. */
export async function generateUniqueReferralCode(): Promise<string> {
  const admin = createAdminClient();

  for (let attempt = 0; attempt < 50; attempt++) {
    const len = 6 + Math.floor(Math.random() * 3);
    let code = "";

    for (let i = 0; i < len; i++) {
      code +=
        REFERRAL_ALPHABET[Math.floor(Math.random() * REFERRAL_ALPHABET.length)];
    }
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();

    if (!data) return code;
  }
  throw new Error("Could not generate a unique referral code");
}

/**
 * One-time assignment (e.g. backfill). DB trigger sets this at signup; updates are blocked by trigger.
 */
export async function assignReferral(newUserId: string, referrerId: string) {
  if (newUserId === referrerId) {
    return { ok: false as const, error: "Self-referral is not allowed" };
  }

  const admin = createAdminClient();
  const { data: row, error: fetchError } = await admin
    .from("profiles")
    .select("id, referred_by_user_id")
    .eq("id", newUserId)
    .single();

  if (fetchError || !row) {
    return { ok: false as const, error: "User not found" };
  }
  if (row.referred_by_user_id != null) {
    return { ok: false as const, error: "Referral already set" };
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ referred_by_user_id: referrerId })
    .eq("id", newUserId)
    .is("referred_by_user_id", null);

  if (updateError) {
    return { ok: false as const, error: updateError.message };
  }

  return { ok: true as const };
}
