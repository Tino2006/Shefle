import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateUniqueReferralCode,
  getUserByReferralCode,
} from "@/lib/referral";

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type EnsureProfileResult = { ok: true } | { ok: false; error: string };

function randomReferralCodeLocal(): string {
  const len = 6 + Math.floor(Math.random() * 3);
  let s = "";

  for (let i = 0; i < len; i++) {
    s += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }

  return s;
}

async function allocateReferralCode(): Promise<string> {
  try {
    return await generateUniqueReferralCode();
  } catch {
    return randomReferralCodeLocal();
  }
}

function namesFromUser(user: User): {
  first: string | null;
  last: string | null;
} {
  const meta = user.user_metadata || {};
  const pick = (k: string): string | null => {
    const v = meta[k];

    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };

  // App fields (manual signup) take precedence, then Google OIDC fields.
  let first = pick("first_name") ?? pick("given_name");
  let last = pick("last_name") ?? pick("family_name");

  // Fall back to splitting a single full-name field for providers that only return one.
  const splitInto = (raw: string | null) => {
    if (!raw) return;
    const parts = raw.split(/\s+/);

    if (!first) first = parts[0] ?? null;
    if (!last && parts.length > 1) last = parts.slice(1).join(" ");
  };

  if (!first || !last) splitInto(pick("full_name"));
  if (!first || !last) splitInto(pick("name"));

  return { first, last };
}

function isSchemaMismatch(message: string, code?: string): boolean {
  if (code === "PGRST204" || code === "42703") return true;
  const m = message.toLowerCase();

  return (
    m.includes("could not find") ||
    m.includes("does not exist") ||
    m.includes("schema cache")
  );
}

function isRlsBlocked(message: string, code?: string): boolean {
  if (code === "42501") return true;
  const m = message.toLowerCase();

  return (
    m.includes("row-level security") ||
    m.includes("violates row-level security")
  );
}

/**
 * Creates `public.profiles` when missing.
 * Tries: full row (referral) → RBAC row → base row; session client then service role.
 */
export async function ensureProfileIfMissing(
  user: User,
  supabase: SupabaseClient,
): Promise<EnsureProfileResult> {
  const { data: existing, error: selectErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  if (selectErr && !isSchemaMismatch(selectErr.message, selectErr.code)) {
    return { ok: false, error: selectErr.message };
  }

  const { first: firstName, last: lastName } = namesFromUser(user);

  if (existing) {
    // Backfill names that the DB trigger left NULL (e.g. Google OAuth users,
    // whose raw_user_meta_data has given_name/family_name, not first/last_name).
    const patch: Record<string, string> = {};

    if (!existing.first_name && firstName) patch.first_name = firstName;
    if (!existing.last_name && lastName) patch.last_name = lastName;
    if (Object.keys(patch).length > 0) {
      const { error: updateErr } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id);

      if (updateErr && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
        try {
          await createAdminClient()
            .from("profiles")
            .update(patch)
            .eq("id", user.id);
        } catch {
          // Best-effort backfill; surface ok regardless so the profile page still loads.
        }
      }
    }

    return { ok: true };
  }

  const meta = user.user_metadata || {};
  const referralMeta =
    typeof meta.referral_code === "string" && meta.referral_code.trim() !== ""
      ? meta.referral_code.trim().toUpperCase()
      : undefined;

  let referredBy: string | null = null;

  if (referralMeta && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    const ref = await getUserByReferralCode(referralMeta);

    if (ref && ref.id !== user.id) {
      referredBy = ref.id;
    }
  }

  let referral_code = await allocateReferralCode();

  let admin: ReturnType<typeof createAdminClient> | null = null;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    try {
      admin = createAdminClient();
    } catch {
      admin = null;
    }
  }

  type Variant = "full" | "rbac" | "base";
  const variants: Variant[] = ["full", "rbac", "base"];

  let lastError = "";

  variantLoop: for (const variant of variants) {
    const clients: { label: string; client: SupabaseClient }[] = [
      { label: "session", client: supabase },
    ];

    if (admin) {
      clients.push({ label: "service_role", client: admin });
    }

    for (const { label, client } of clients) {
      const maxAttempts = variant === "full" ? 8 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (variant === "full" && attempt > 0) {
          referral_code = await allocateReferralCode();
        }

        let row: Record<string, unknown>;

        if (variant === "full") {
          row = {
            id: user.id,
            first_name: firstName,
            last_name: lastName,
            role: "user",
            referral_code,
            referred_by_user_id: referredBy,
          };
        } else if (variant === "rbac") {
          row = {
            id: user.id,
            first_name: firstName,
            last_name: lastName,
            role: "user",
          };
        } else {
          row = {
            id: user.id,
            first_name: firstName,
            last_name: lastName,
          };
        }

        const { error } = await client.from("profiles").insert(row as never);

        if (!error) {
          return { ok: true };
        }

        lastError = error.message;

        if (error.code === "23505") {
          return { ok: true };
        }

        if (isSchemaMismatch(error.message, error.code)) {
          continue variantLoop;
        }

        if (
          label === "session" &&
          isRlsBlocked(error.message, error.code) &&
          admin
        ) {
          break;
        }

        if (
          variant === "full" &&
          /referral_code|idx_profiles_referral|unique/i.test(error.message)
        ) {
          continue;
        }

        break;
      }
    }
  }

  return {
    ok: false,
    error:
      lastError ||
      "Could not insert profile. Run supabase-profiles-rls-fix.sql in the Supabase SQL editor and confirm migrations.",
  };
}
