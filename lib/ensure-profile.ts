import { createAdminClient } from '@/lib/supabase/admin';
import { generateUniqueReferralCode, getUserByReferralCode } from '@/lib/referral';

/**
 * If the DB trigger on auth.users did not create a row (misconfigured migration, etc.),
 * create the profile with service role. No-op when a row already exists.
 */
export async function ensureProfileAfterSignup(params: {
  userId: string;
  firstName: string;
  lastName: string;
  referralMeta?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { ok: false, error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('id', params.userId)
    .maybeSingle();

  if (existing) {
    return { ok: true };
  }

  let referredBy: string | null = null;
  if (params.referralMeta) {
    const ref = await getUserByReferralCode(params.referralMeta);
    if (ref && ref.id !== params.userId) {
      referredBy = ref.id;
    }
  }

  let referral_code: string;
  try {
    referral_code = await generateUniqueReferralCode();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not allocate referral code',
    };
  }

  const row: Record<string, unknown> = {
    id: params.userId,
    first_name: params.firstName,
    last_name: params.lastName,
    role: 'user',
    referral_code,
    referred_by_user_id: referredBy,
  };

  const { error } = await admin.from('profiles').insert(row);

  if (!error) {
    return { ok: true };
  }

  // Race: trigger inserted between check and insert
  if (error.code === '23505') {
    return { ok: true };
  }

  const { data: again } = await admin.from('profiles').select('id').eq('id', params.userId).maybeSingle();
  if (again) {
    return { ok: true };
  }

  return { ok: false, error: error.message };
}
