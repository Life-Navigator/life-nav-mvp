/**
 * Feature Flag Service — Sprint M Phase 6.
 *
 * Reads `ops.feature_flags` + `ops.user_feature_flag_overrides`
 * (+ optional `ops.user_cohorts`) and returns a deterministic
 * per-user verdict.
 *
 *   Resolution order:
 *     1. per-user override (with expiry honored) — terminal
 *     2. allowed_user_ids match — TRUE
 *     3. cohort match + enabled — TRUE
 *     4. percentage rollout based on stable user hash — TRUE/FALSE
 *     5. flag.enabled — terminal
 *
 * Pure-logic core (`evaluateFlag`) so we can test without a DB. The
 * DB-bound `isEnabled` is a thin async wrapper.
 */

export interface FeatureFlagRow {
  slug: string;
  enabled: boolean;
  flag_kind: 'boolean' | 'percentage' | 'cohort' | 'allow_list' | 'env';
  rollout_pct?: number | null;
  cohort_slug?: string | null;
  allowed_user_ids: string[];
}

export interface UserOverrideRow {
  flag_slug: string;
  enabled: boolean;
  expires_at?: string | null;
}

export interface EvaluateInputs {
  flag: FeatureFlagRow;
  user_id?: string;
  user_cohorts?: string[];
  user_override?: UserOverrideRow;
  now?: string;
}

export interface FlagEvaluation {
  enabled: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Stable per-user hash → [0, 100). Used for percentage rollouts.
// ---------------------------------------------------------------------------

function djb2Pct(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0) % 100;
}

function userBucket(user_id: string, flag_slug: string): number {
  return djb2Pct(`${flag_slug}::${user_id}`);
}

// ---------------------------------------------------------------------------
// Pure evaluator
// ---------------------------------------------------------------------------

export function evaluateFlag(i: EvaluateInputs): FlagEvaluation {
  const f = i.flag;
  const now = i.now ?? new Date().toISOString();

  // 1. Per-user override.
  if (i.user_override) {
    const o = i.user_override;
    if (!o.expires_at || o.expires_at > now) {
      return { enabled: o.enabled, reason: 'override' };
    }
  }

  // 2. Allow-list match.
  if (i.user_id && f.allowed_user_ids?.includes(i.user_id)) {
    return { enabled: true, reason: 'allow_list' };
  }

  // 3. Cohort match.
  if (f.cohort_slug && i.user_cohorts?.includes(f.cohort_slug)) {
    return { enabled: f.enabled, reason: 'cohort' };
  }

  // 4. Percentage rollout.
  if (typeof f.rollout_pct === 'number' && f.rollout_pct < 100 && i.user_id) {
    const bucket = userBucket(i.user_id, f.slug);
    if (bucket < f.rollout_pct) {
      return { enabled: f.enabled, reason: 'rollout_pct_in' };
    }
    return { enabled: false, reason: 'rollout_pct_out' };
  }

  // 5. Default to flag.enabled.
  return { enabled: f.enabled, reason: 'default' };
}

// ---------------------------------------------------------------------------
// DB-bound facade
// ---------------------------------------------------------------------------

export interface FlagServiceClient {
  supabase: any;
  user_id?: string;
}

export async function isEnabled(
  client: FlagServiceClient,
  flag_slug: string
): Promise<FlagEvaluation> {
  const flagRes = await client.supabase
    .from('ops_feature_flags')
    .select('*')
    .eq('slug', flag_slug)
    .maybeSingle();
  if (!flagRes.data) return { enabled: false, reason: 'unknown_flag' };

  const flag = flagRes.data as FeatureFlagRow;

  let user_override: UserOverrideRow | undefined;
  let user_cohorts: string[] = [];
  if (client.user_id) {
    const [ovRes, cohRes] = await Promise.all([
      client.supabase
        .from('ops_user_feature_flag_overrides')
        .select('flag_slug, enabled, expires_at')
        .eq('user_id', client.user_id)
        .eq('flag_slug', flag_slug)
        .maybeSingle(),
      client.supabase
        .from('ops_user_cohorts')
        .select('cohort_slug')
        .eq('user_id', client.user_id)
        .is('left_at', null),
    ]);
    if (ovRes.data) user_override = ovRes.data as UserOverrideRow;
    if (Array.isArray(cohRes.data))
      user_cohorts = cohRes.data.map((r: { cohort_slug: string }) => r.cohort_slug);
  }

  return evaluateFlag({
    flag,
    user_id: client.user_id,
    user_cohorts,
    user_override,
  });
}

export const __test = { evaluateFlag, djb2Pct, userBucket };
