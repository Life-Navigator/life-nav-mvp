/**
 * ProviderAccessService — the gatekeeper between providers and patient
 * data.
 *
 * Two layers:
 *
 *   1. `verifyAccess(...)` — PURE function. Mirrors the SECURITY DEFINER
 *      function `providers.has_access_to(...)` so the TS layer can
 *      pre-flight a decision without round-tripping to Postgres. Used
 *      for fast denial in the route handler and for unit tests.
 *
 *   2. `hasAccessTo(supabase, ...)` — wraps the SQL function via RPC.
 *      This is the source of truth at runtime. The TS pre-flight must
 *      never grant access that the SQL function would deny — tests
 *      enforce this invariant.
 */

type SupabaseClient = any;
import type {
  AccessDecision,
  ProviderDomain,
  ProviderEngagement,
  ProviderProfile,
  SensitivityLevel,
} from '@/types/provider';

const SENSITIVITY_RANK: Record<SensitivityLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

// ---------------------------------------------------------------------------
// Pure verification (mirrors providers.has_access_to)
// ---------------------------------------------------------------------------

export interface VerifyAccessInputs {
  provider?: Pick<ProviderProfile, 'id' | 'user_id' | 'verified'> | null;
  engagement?: Pick<
    ProviderEngagement,
    'status' | 'allowed_domains' | 'max_sensitivity' | 'accepted_at' | 'revoked_at' | 'expires_at'
  > | null;
  requested_domain: ProviderDomain;
  requested_sensitivity: SensitivityLevel;
  now?: string; // ISO; defaults to current time
}

export function verifyAccess(inputs: VerifyAccessInputs): AccessDecision {
  const reasons: AccessDecision['reasons'] = [];
  const now = inputs.now ? new Date(inputs.now).getTime() : Date.now();

  if (!inputs.provider) reasons.push('provider_not_verified');
  else if (!inputs.provider.verified) reasons.push('provider_not_verified');

  const e = inputs.engagement;
  if (!e) reasons.push('engagement_missing');
  else {
    if (e.status !== 'active') reasons.push('engagement_not_active');
    if (!e.accepted_at) reasons.push('engagement_not_accepted');
    if (e.revoked_at) reasons.push('engagement_revoked');
    if (e.expires_at && new Date(e.expires_at).getTime() < now) {
      reasons.push('engagement_expired');
    }
    if (!e.allowed_domains?.includes(inputs.requested_domain)) {
      reasons.push('domain_out_of_scope');
    }
    if (
      SENSITIVITY_RANK[inputs.requested_sensitivity] >
      SENSITIVITY_RANK[e.max_sensitivity ?? 'medium']
    ) {
      reasons.push('sensitivity_exceeds_max');
    }
  }
  return { allowed: reasons.length === 0, reasons: dedupe(reasons) };
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// ---------------------------------------------------------------------------
// SQL-backed gate
// ---------------------------------------------------------------------------

export async function hasAccessTo(
  supabase: SupabaseClient,
  patient_user_id: string,
  domain: ProviderDomain,
  min_sensitivity: SensitivityLevel = 'low'
): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_access_to', {
    p_provider_user_id: undefined, // sentinel — function reads auth.uid()
    p_patient_user_id: patient_user_id,
    p_domain: domain,
    p_min_sensitivity: min_sensitivity,
  });
  // The SQL function reads auth.uid() itself; we don't need to pass it.
  // Older Supabase clients drop undefined keys, which is what we want.
  if (error) return false;
  return data === true;
}

// ---------------------------------------------------------------------------
// Engagement loader (RLS-bounded)
// ---------------------------------------------------------------------------

export async function loadEngagementForPatient(
  supabase: SupabaseClient,
  patient_user_id: string
): Promise<{
  provider?: ProviderProfile;
  engagement?: ProviderEngagement;
}> {
  // Provider identity is the calling auth user.
  const { data: profile } = await supabase
    .from('provider_profiles')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (!profile) return {};
  const { data: engagement } = await supabase
    .from('provider_engagements')
    .select('*')
    .eq('provider_id', profile.id)
    .eq('patient_user_id', patient_user_id)
    .maybeSingle();
  return { provider: profile, engagement: engagement ?? undefined };
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export const __test = { verifyAccess, SENSITIVITY_RANK };
