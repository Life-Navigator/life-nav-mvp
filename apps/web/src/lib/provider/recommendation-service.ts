/**
 * ProviderRecommendationService — issue + retrieve + accept/reject
 * + complete provider recommendations.
 *
 * Wraps `providers.provider_recommendations` + `providers.provider_outcomes`.
 *
 * Determinism:
 *   * `computeRecommendationLifecycleStats` is pure — takes rows,
 *     returns aggregates. Identical rows → identical aggregates.
 *
 * Authorization:
 *   * The INSERT policy on `providers.provider_recommendations`
 *     requires `providers.has_access_to(...)` to return TRUE plus the
 *     calling auth user to be the provider. So this service is a
 *     thin wrapper — the database is the gatekeeper.
 */

type SupabaseClient = any;
import type {
  ProviderDomain,
  ProviderOutcome,
  ProviderRecommendation,
  ProviderRecommendationStatus,
} from '@/types/provider';

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

export interface IssueRecommendationInput {
  provider_id: string;
  patient_user_id: string;
  engagement_id: string;
  domain: ProviderDomain;
  title: string;
  body: string;
  rationale?: string;
  related_goal_id?: string;
  expected_horizon_months?: number;
  expected_strength?: number;
  citations?: Array<{
    label: string;
    source?: string;
    citation_reference?: string;
    confidence?: number;
  }>;
  metadata?: Record<string, unknown>;
}

export async function issueRecommendation(
  supabase: SupabaseClient,
  input: IssueRecommendationInput
): Promise<ProviderRecommendation | null> {
  const row = {
    provider_id: input.provider_id,
    patient_user_id: input.patient_user_id,
    engagement_id: input.engagement_id,
    domain: input.domain,
    title: input.title,
    body: input.body,
    rationale: input.rationale ?? null,
    related_goal_id: input.related_goal_id ?? null,
    expected_horizon_months: input.expected_horizon_months ?? null,
    expected_strength: input.expected_strength ?? null,
    citations: input.citations ?? [],
    status: 'issued' as ProviderRecommendationStatus,
    metadata: input.metadata ?? {},
  };
  const { data, error } = await supabase
    .from('provider_recommendations')
    .insert(row)
    .select('*')
    .single();
  if (error) return null;
  return data as ProviderRecommendation;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface ListRecommendationsQuery {
  patient_user_id?: string;
  provider_id?: string;
  status?: ProviderRecommendationStatus;
  since?: string;
}

export async function listRecommendations(
  supabase: SupabaseClient,
  q: ListRecommendationsQuery
): Promise<ProviderRecommendation[]> {
  let qb = supabase.from('provider_recommendations').select('*');
  if (q.patient_user_id) qb = qb.eq('patient_user_id', q.patient_user_id);
  if (q.provider_id) qb = qb.eq('provider_id', q.provider_id);
  if (q.status) qb = qb.eq('status', q.status);
  if (q.since) qb = qb.gte('issued_at', q.since);
  qb = qb.order('issued_at', { ascending: false });
  const { data, error } = await qb;
  if (error) return [];
  return (data ?? []) as ProviderRecommendation[];
}

// ---------------------------------------------------------------------------
// Patient-side state transitions
// ---------------------------------------------------------------------------

export interface PatientResponseInput {
  recommendation_id: string;
  decision: 'accept' | 'reject' | 'complete';
  reason?: string;
}

export async function recordPatientResponse(
  supabase: SupabaseClient,
  input: PatientResponseInput
): Promise<ProviderRecommendation | null> {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {};
  switch (input.decision) {
    case 'accept':
      updates.accepted_at = now;
      updates.status = 'accepted';
      break;
    case 'reject':
      updates.rejected_at = now;
      updates.rejected_reason = input.reason ?? null;
      updates.status = 'rejected';
      break;
    case 'complete':
      updates.completed_at = now;
      updates.status = 'completed';
      break;
  }
  const { data, error } = await supabase
    .from('provider_recommendations')
    .update(updates)
    .eq('id', input.recommendation_id)
    .select('*')
    .single();
  if (error) return null;
  return data as ProviderRecommendation;
}

// ---------------------------------------------------------------------------
// Outcome attribution
// ---------------------------------------------------------------------------

export interface RecordOutcomeInput {
  recommendation_id: string;
  patient_user_id: string;
  provider_id: string;
  dimension: string;
  observed_value?: number;
  observed_unit?: string;
  expected_value?: number;
  source?: 'self_report' | 'provider_report' | 'wearable' | 'lab' | 'computed';
  user_satisfaction?: number;
  outcome_quality?: number;
  notes?: string;
}

export async function recordOutcome(
  supabase: SupabaseClient,
  input: RecordOutcomeInput
): Promise<ProviderOutcome | null> {
  const delta =
    input.observed_value != null && input.expected_value != null
      ? input.observed_value - input.expected_value
      : null;
  const denom = input.expected_value == null ? 1 : Math.max(1, Math.abs(input.expected_value));
  const accuracy_score = delta == null ? null : clamp01(1 - Math.min(1, Math.abs(delta) / denom));

  const row = {
    recommendation_id: input.recommendation_id,
    patient_user_id: input.patient_user_id,
    provider_id: input.provider_id,
    dimension: input.dimension,
    observed_value: input.observed_value ?? null,
    observed_unit: input.observed_unit ?? null,
    expected_value: input.expected_value ?? null,
    delta,
    accuracy_score,
    user_satisfaction: input.user_satisfaction ?? null,
    outcome_quality: input.outcome_quality ?? null,
    source: input.source ?? 'self_report',
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase.from('provider_outcomes').insert(row).select('*').single();
  if (error) return null;
  return data as ProviderOutcome;
}

// ---------------------------------------------------------------------------
// Pure aggregation
// ---------------------------------------------------------------------------

export interface RecommendationLifecycleStats {
  issued: number;
  accepted: number;
  rejected: number;
  modified: number;
  completed: number;
  abandoned: number;
  acceptance_rate: number; // accepted / issued
  completion_rate: number; // completed / (accepted + completed + abandoned)
}

const ACCEPTED_FAMILY: ProviderRecommendationStatus[] = [
  'accepted',
  'completed',
  'abandoned',
  'modified',
];

export function computeRecommendationLifecycleStats(
  rows: ProviderRecommendation[]
): RecommendationLifecycleStats {
  const issued = rows.length;
  const tally = (s: ProviderRecommendationStatus) => rows.filter((r) => r.status === s).length;
  const accepted = tally('accepted');
  const rejected = tally('rejected');
  const modified = tally('modified');
  const completed = tally('completed');
  const abandoned = tally('abandoned');
  const acceptDenom = issued;
  const completeDenom = ACCEPTED_FAMILY.reduce((a, s) => a + tally(s), 0);
  return {
    issued,
    accepted,
    rejected,
    modified,
    completed,
    abandoned,
    acceptance_rate: safeDiv(accepted, acceptDenom),
    completion_rate: safeDiv(completed, completeDenom),
  };
}

function safeDiv(n: number, d: number): number {
  return d === 0 ? 0 : n / d;
}
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export const __test = { computeRecommendationLifecycleStats, ACCEPTED_FAMILY };
