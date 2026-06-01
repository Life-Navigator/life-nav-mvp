/**
 * CrossDomainAttributionService
 *
 *   Health → Productivity → Career → Income → Net Worth
 *
 * Two surfaces:
 *
 *   * `cross_domain_impacts`     — typed edge between two domains
 *     (CONTRIBUTED_TO / INFLUENCED / ACCELERATED / DELAYED / BLOCKED /
 *     SUPPORTED) with strength + confidence + evidence.
 *
 *   * `outcome_attributions`     — what share of credit (or blame) a
 *     decision deserves for a specific outcome. attribution_share is
 *     in [0,1]; we normalize across siblings so the total across an
 *     outcome's attributions ≤ 1.
 *
 * The chain traversal returns a directed graph (BFS, depth-limited)
 * so the AdvisorReasoningService can show "this outcome rolled back
 * to those upstream decisions" in O(edges).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AttributionLabel,
  CrossDomainImpact,
  DomainKey,
  OutcomeAttribution,
} from '@/types/decision-intelligence';

// ---------------------------------------------------------------------------
// Record
// ---------------------------------------------------------------------------

export interface RecordCrossDomainImpactInput {
  user_id: string;
  source_domain: DomainKey;
  target_domain: DomainKey;
  label: AttributionLabel;
  strength: number;
  confidence: number;
  evidence?: Array<Record<string, unknown>>;
  source_outcome_id?: string;
  source_goal_id?: string;
  target_goal_id?: string;
  observed_at?: string;
}

export async function recordCrossDomainImpact(
  supabase: SupabaseClient,
  input: RecordCrossDomainImpactInput
): Promise<CrossDomainImpact> {
  const row = {
    user_id: input.user_id,
    source_domain: input.source_domain,
    target_domain: input.target_domain,
    label: input.label,
    strength: clamp01(input.strength),
    confidence: clamp01(input.confidence),
    evidence: input.evidence ?? [],
    source_outcome_id: input.source_outcome_id ?? null,
    source_goal_id: input.source_goal_id ?? null,
    target_goal_id: input.target_goal_id ?? null,
    observed_at: input.observed_at ?? new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('cross_domain_impacts')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data as CrossDomainImpact;
}

export interface RecordOutcomeAttributionInput {
  user_id: string;
  outcome_id: string;
  attributed_to_decision_id?: string;
  attributed_to_action_id?: string;
  attributed_to_recommendation_summary?: string;
  attribution_share: number;
  confidence: number;
  reasoning?: string;
}

export async function recordOutcomeAttribution(
  supabase: SupabaseClient,
  input: RecordOutcomeAttributionInput
): Promise<OutcomeAttribution> {
  const row = {
    user_id: input.user_id,
    outcome_id: input.outcome_id,
    attributed_to_decision_id: input.attributed_to_decision_id ?? null,
    attributed_to_action_id: input.attributed_to_action_id ?? null,
    attributed_to_recommendation_summary: input.attributed_to_recommendation_summary ?? null,
    attribution_share: clamp01(input.attribution_share),
    confidence: clamp01(input.confidence),
    reasoning: input.reasoning ?? null,
  };
  const { data, error } = await supabase
    .from('outcome_attributions')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data as OutcomeAttribution;
}

// ---------------------------------------------------------------------------
// Pure: normalize attribution shares for an outcome so they total ≤ 1.
// ---------------------------------------------------------------------------

export function normalizeAttributionShares(
  attributions: OutcomeAttribution[]
): OutcomeAttribution[] {
  if (attributions.length === 0) return attributions;
  const total = attributions.reduce((a, x) => a + clamp01(x.attribution_share), 0);
  if (total <= 1) return attributions;
  // Scale all proportionally so they sum to 1.
  return attributions.map((x) => ({
    ...x,
    attribution_share: clamp01(x.attribution_share) / total,
  }));
}

// ---------------------------------------------------------------------------
// Pure: traverse impact chain.
// ---------------------------------------------------------------------------

export interface ImpactChainNode {
  domain: DomainKey;
  goal_id?: string;
  outcome_id?: string;
  depth: number;
  cumulative_strength: number;
  via_labels: AttributionLabel[];
}

export interface ImpactChain {
  start: { domain: DomainKey; outcome_id?: string; goal_id?: string };
  nodes: ImpactChainNode[];
  edges: Array<{
    source_domain: DomainKey;
    target_domain: DomainKey;
    label: AttributionLabel;
    strength: number;
    confidence: number;
  }>;
  max_depth_reached: number;
}

/**
 * BFS from a starting outcome / goal through `cross_domain_impacts`.
 * Strength along a chain is the product of edge strengths. Stops at
 * `max_depth` or when no further outgoing edges exist.
 */
export function traverseImpactChain(
  start: { domain: DomainKey; outcome_id?: string; goal_id?: string },
  edges: CrossDomainImpact[],
  options: { max_depth?: number } = {}
): ImpactChain {
  const maxDepth = Math.max(1, options.max_depth ?? 4);
  const nodes = new Map<string, ImpactChainNode>();
  const edgeOut: ImpactChain['edges'] = [];
  let maxReached = 0;
  const queue: Array<{
    domain: DomainKey;
    depth: number;
    strength: number;
    via: AttributionLabel[];
  }> = [{ domain: start.domain, depth: 0, strength: 1, via: [] }];
  const seen = new Set<string>([start.domain]);

  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.depth >= maxDepth) continue;
    const outgoing = edges.filter((e) => e.source_domain === cur.domain);
    for (const e of outgoing) {
      const key = `${e.target_domain}@${cur.depth + 1}`;
      const nextStrength = cur.strength * clamp01(e.strength);
      const nextVia: AttributionLabel[] = [...cur.via, e.label];
      if (!nodes.has(key)) {
        nodes.set(key, {
          domain: e.target_domain,
          depth: cur.depth + 1,
          cumulative_strength: nextStrength,
          via_labels: nextVia,
        });
      } else {
        const prev = nodes.get(key)!;
        if (nextStrength > prev.cumulative_strength) {
          prev.cumulative_strength = nextStrength;
          prev.via_labels = nextVia;
        }
      }
      edgeOut.push({
        source_domain: e.source_domain,
        target_domain: e.target_domain,
        label: e.label,
        strength: clamp01(e.strength),
        confidence: clamp01(e.confidence),
      });
      maxReached = Math.max(maxReached, cur.depth + 1);
      const seenKey = `${e.target_domain}@${cur.depth + 1}`;
      if (!seen.has(seenKey)) {
        seen.add(seenKey);
        queue.push({
          domain: e.target_domain,
          depth: cur.depth + 1,
          strength: nextStrength,
          via: nextVia,
        });
      }
    }
  }

  return {
    start,
    nodes: Array.from(nodes.values()).sort(
      (a, b) => a.depth - b.depth || b.cumulative_strength - a.cumulative_strength
    ),
    edges: edgeOut,
    max_depth_reached: maxReached,
  };
}

// ---------------------------------------------------------------------------
// Load helpers
// ---------------------------------------------------------------------------

export async function loadCrossDomainImpacts(
  supabase: SupabaseClient,
  userId: string,
  options: { since?: string } = {}
): Promise<CrossDomainImpact[]> {
  let qb = supabase.from('cross_domain_impacts').select('*').eq('user_id', userId);
  if (options.since) qb = qb.gte('observed_at', options.since);
  const { data, error } = await qb;
  if (error) throw error;
  return (data ?? []) as CrossDomainImpact[];
}

export async function loadOutcomeAttributions(
  supabase: SupabaseClient,
  userId: string,
  outcomeId?: string
): Promise<OutcomeAttribution[]> {
  let qb = supabase.from('outcome_attributions').select('*').eq('user_id', userId);
  if (outcomeId) qb = qb.eq('outcome_id', outcomeId);
  const { data, error } = await qb;
  if (error) throw error;
  return (data ?? []) as OutcomeAttribution[];
}

// ---------------------------------------------------------------------------
// Re-exports for tests.
// ---------------------------------------------------------------------------

function clamp01(n: number | null | undefined): number {
  if (n == null || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export const __test = { normalizeAttributionShares, traverseImpactChain, clamp01 };
