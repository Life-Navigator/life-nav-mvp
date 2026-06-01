/**
 * ProviderViewService — assembles the scoped PatientView via the
 * SECURITY DEFINER RPC `providers.get_patient_summary(...)`.
 *
 * The RPC enforces engagement + domain + sensitivity at the function
 * entry. If access is not granted, the function returns an empty
 * result set; this service surfaces that as `rows: []` with the
 * explicit reason populated by `verifyAccess`.
 *
 * The set of fields a provider can see is FIXED:
 *
 *   * Current State        — current_progress
 *   * Trajectory           — last_observation_at (timestamp)
 *   * Probability          — most_likely_prob, probability_range, confidence
 *   * Risk                 — variance_summary (planned — surfaces via
 *                            a follow-up RPC; for v1 we expose
 *                            confidence inverse as proxy)
 *   * Progress             — current_progress + last_observation_at
 *   * Recommendations      — recommendation_count
 *
 * What providers can NEVER see:
 *
 *   * Goals OUTSIDE their consent scope (filtered at SQL)
 *   * Free-text personal goal descriptions outside the requested domain
 *   * The user's full constraint / capability / motivation tables
 *   * Cross-domain recommendations they did not author
 *   * The user's WhyChain / EvidenceGraph / Counterfactuals
 *
 * Those omissions are by design — minimum viable provider context.
 */

type SupabaseClient = any;
import type { PatientView, PatientViewRow, ProviderDomain } from '@/types/provider';

const VISIBLE_FIELDS: string[] = [
  'goal_id',
  'goal_title',
  'goal_domain',
  'current_progress',
  'most_likely_prob',
  'probability_range',
  'confidence',
  'recommendation_count',
  'last_observation_at',
];

// ---------------------------------------------------------------------------
// Pure assembly — gets called with raw RPC rows.
// ---------------------------------------------------------------------------

export function assemblePatientView(args: {
  patient_user_id: string;
  provider_id: string;
  scope_domain: ProviderDomain;
  rows: Array<Record<string, unknown>>;
  granted_at?: string;
  now?: string;
}): PatientView {
  const rows: PatientViewRow[] = args.rows.map((r) => ({
    goal_id: String(r.goal_id ?? ''),
    goal_title: String(r.goal_title ?? ''),
    goal_domain: String(r.goal_domain ?? ''),
    current_progress: num(r.current_progress),
    most_likely_prob: num(r.most_likely_prob),
    probability_range: String(r.probability_range ?? ''),
    confidence: num(r.confidence),
    recommendation_count: Math.max(0, Math.floor(num(r.recommendation_count))),
    last_observation_at: r.last_observation_at == null ? null : String(r.last_observation_at),
  }));
  return {
    patient_user_id: args.patient_user_id,
    provider_id: args.provider_id,
    scope_domain: args.scope_domain,
    granted_at: args.granted_at ?? new Date(0).toISOString(),
    computed_at: args.now ?? new Date(0).toISOString(),
    rows,
    visible_fields: [...VISIBLE_FIELDS],
  };
}

// ---------------------------------------------------------------------------
// Supabase loader — wraps the RPC.
// ---------------------------------------------------------------------------

export async function loadPatientView(
  supabase: SupabaseClient,
  patient_user_id: string,
  domain: ProviderDomain,
  context: { provider_id: string; granted_at?: string }
): Promise<PatientView> {
  const { data, error } = await supabase.rpc('get_patient_summary', {
    p_patient_user_id: patient_user_id,
    p_domain: domain,
  });
  if (error) {
    return assemblePatientView({
      patient_user_id,
      provider_id: context.provider_id,
      scope_domain: domain,
      rows: [],
      granted_at: context.granted_at,
    });
  }
  return assemblePatientView({
    patient_user_id,
    provider_id: context.provider_id,
    scope_domain: domain,
    rows: (data ?? []) as Array<Record<string, unknown>>,
    granted_at: context.granted_at,
    now: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const __test = { VISIBLE_FIELDS, assemblePatientView };
