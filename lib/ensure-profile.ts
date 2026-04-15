import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateUniqueReferralCode, getUserByReferralCode } from '@/lib/referral';

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type EnsureProfileResult = { ok: true } | { ok: false; error: string };

function randomReferralCodeLocal(): string {
  const len = 6 + Math.floor(Math.random() * 3);
  let s = '';
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

function namesFromUser(user: User): { first: string | null; last: string | null } {
  const meta = user.user_metadata || {};
  let first =
    typeof meta.first_name === 'string' && meta.first_name.trim() !== ''
      ? meta.first_name.trim()
      : null;
  let last =
    typeof meta.last_name === 'string' && meta.last_name.trim() !== ''
      ? meta.last_name.trim()
      : null;

  if (!first && typeof meta.full_name === 'string' && meta.full_name.trim() !== '') {
    const parts = meta.full_name.trim().split(/\s+/);
    first = parts[0] ?? null;
    last = parts.length > 1 ? parts.slice(1).join(' ') : last;
  }
  if (!first && typeof meta.name === 'string' && meta.name.trim() !== '') {
    const parts = meta.name.trim().split(/\s+/);
    first = parts[0] ?? null;
    last = parts.length > 1 ? parts.slice(1).join(' ') : last;
  }

  return { first, last };
}

function isSchemaMismatch(message: string, code?: string): boolean {
  if (code === 'PGRST204' || code === '42703') return true;
  const m = message.toLowerCase();
  return m.includes('could not find') || m.includes('does not exist') || m.includes('schema cache');
}

function isRlsBlocked(message: string, code?: string): boolean {
  if (code === '42501') return true;
  const m = message.toLowerCase();
  return m.includes('row-level security') || m.includes('violates row-level security');
}

/**
 * Creates `public.profiles` when missing.
 * Tries: full row (referral) → RBAC row → base row; session client then service role.
 */
export async function ensureProfileIfMissing(
  user: User,
  supabase: SupabaseClient
): Promise<EnsureProfileResult> {
  const { data: existing, error: selectErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (selectErr && !isSchemaMismatch(selectErr.message, selectErr.code)) {
    return { ok: false, error: selectErr.message };
  }
  if (existing) {
    return { ok: true };
  }

  const { first: firstName, last: lastName } = namesFromUser(user);
  const meta = user.user_metadata || {};
  const referralMeta =
    typeof meta.referral_code === 'string' && meta.referral_code.trim() !== ''
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

  type Variant = 'full' | 'rbac' | 'base';
  const variants: Variant[] = ['full', 'rbac', 'base'];

  let lastError = '';

  variantLoop: for (const variant of variants) {
    const clients: { label: string; client: SupabaseClient }[] = [{ label: 'session', client: supabase }];
    if (admin) {
      clients.push({ label: 'service_role', client: admin });
    }

    for (const { label, client } of clients) {
      const maxAttempts = variant === 'full' ? 8 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (variant === 'full' && attempt > 0) {
          referral_code = await allocateReferralCode();
        }

        let row: Record<string, unknown>;
        if (variant === 'full') {
          row = {
            id: user.id,
            first_name: firstName,
            last_name: lastName,
            role: 'user',
            referral_code,
            referred_by_user_id: referredBy,
          };
        } else if (variant === 'rbac') {
          row = {
            id: user.id,
            first_name: firstName,
            last_name: lastName,
            role: 'user',
          };
        } else {
          row = {
            id: user.id,
            first_name: firstName,
            last_name: lastName,
          };
        }

        const { error } = await client.from('profiles').insert(row as never);

        if (!error) {
          return { ok: true };
        }

        lastError = error.message;

        if (error.code === '23505') {
          return { ok: true };
        }

        if (isSchemaMismatch(error.message, error.code)) {
          continue variantLoop;
        }

        if (label === 'session' && isRlsBlocked(error.message, error.code) && admin) {
          break;
        }

        if (variant === 'full' && /referral_code|idx_profiles_referral|unique/i.test(error.message)) {
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
      'Could not insert profile. Run supabase-profiles-rls-fix.sql in the Supabase SQL editor and confirm migrations.',
  };
}
