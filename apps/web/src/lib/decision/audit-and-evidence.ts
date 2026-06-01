/**
 * AuditTrailRecorder + EvidenceGraphService — DETERMINISTIC.
 *
 *   recordAudit(supabase, entry)               — persists a frozen snapshot
 *                                                  of the engine inputs +
 *                                                  intermediate steps +
 *                                                  output summary.
 *   buildEvidenceGraph(target)                 — pure: walks the
 *                                                  structured XAI envelope
 *                                                  into a {nodes, edges}
 *                                                  graph.
 *   persistEvidenceLinks(supabase, links)      — bulk-insert into
 *                                                  evidence_links.
 *
 * No LLM. Same input → same evidence graph (modulo `computed_at`).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { RecommendationOutput } from '@/types/advisor';
import type {
  CatchUpPlan,
  AheadOfPlanPlan,
  DecisionImpact,
  MarginalImpactRanking,
  ProbabilityDistribution,
} from '@/types/decision-impact';
import type {
  AuditTargetKind,
  AuditTrailEntry,
  EvidenceEdge,
  EvidenceGraph,
  EvidenceNode,
  EvidenceSourceKind,
} from '@/types/xai';

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export async function recordAudit(
  supabase: SupabaseClient,
  entry: AuditTrailEntry
): Promise<{ id: string } | null> {
  const sb = supabase as any;
  const row = {
    user_id: entry.user_id,
    advisor_run_id: entry.advisor_run_id ?? null,
    target_kind: entry.target_kind,
    target_id: entry.target_id ?? null,
    input_snapshot: entry.input_snapshot,
    engine_versions: entry.engine_versions ?? {},
    intermediate: entry.intermediate ?? {},
    output_summary: entry.output_summary,
    duration_ms: entry.duration_ms ?? null,
  };
  const { data, error } = await sb
    .from('recommendation_audit_trail')
    .upsert(row, { onConflict: 'user_id,advisor_run_id,target_kind,target_id' })
    .select('id')
    .single();
  if (error) return null;
  return data as { id: string };
}

// ---------------------------------------------------------------------------
// Evidence graph — pure builder
// ---------------------------------------------------------------------------

export type EvidenceTarget =
  | { kind: 'recommendation_output'; value: RecommendationOutput; target_id?: string }
  | { kind: 'goal_decision_impact'; value: DecisionImpact; target_id?: string }
  | { kind: 'goal_probability_distribution'; value: ProbabilityDistribution; target_id?: string }
  | { kind: 'catch_up_plan'; value: CatchUpPlan; target_id?: string }
  | { kind: 'ahead_of_plan_plan'; value: AheadOfPlanPlan; target_id?: string }
  | { kind: 'marginal_impact_ranking'; value: MarginalImpactRanking; target_id?: string };

export interface BuildEvidenceGraphOptions {
  user_id: string;
  computed_at?: string; // default '1970-01-01T00:00:00.000Z' for determinism
}

export function buildEvidenceGraph(
  target: EvidenceTarget,
  options: BuildEvidenceGraphOptions
): EvidenceGraph {
  const nodes: EvidenceNode[] = [];
  const edges: EvidenceEdge[] = [];

  const addNode = (node: EvidenceNode) => {
    if (!nodes.find((n) => n.id === node.id)) nodes.push(node);
  };
  const addEdge = (from: string, to: string, label: EvidenceEdge['label']) => {
    const key = `${from}->${to}::${label}`;
    if (!edges.find((e) => `${e.from_node_id}->${e.to_node_id}::${e.label}` === key)) {
      edges.push({ from_node_id: from, to_node_id: to, label });
    }
  };

  // Root node = the target itself.
  const rootId = `target::${target.kind}`;
  addNode({
    id: rootId,
    kind: 'self_report',
    label: targetLabel(target),
    confidence: targetConfidence(target),
    weight: 1.0,
  });

  // Pull from the XAI explanation envelope on each target.
  const ev = explanationEvidence(target);
  for (const e of ev) {
    const id = `ev::${e.kind}::${e.label}`;
    addNode({
      id,
      kind: e.kind,
      label: e.label,
      citation_reference: e.citation_reference,
      confidence: e.confidence,
      weight: e.weight ?? 1.0,
    });
    addEdge(rootId, id, 'cites');
  }

  // Target-specific deeper evidence.
  for (const e of targetSpecificEvidence(target)) {
    const id = `tev::${e.kind}::${e.label}`;
    addNode({
      id,
      kind: e.kind,
      label: e.label,
      citation_reference: e.citation_reference,
      source_id: e.source_id,
      confidence: e.confidence,
      weight: e.weight ?? 1.0,
    });
    addEdge(rootId, id, e.kind === 'assumption' ? 'derived_from' : 'corroborates');
  }

  return {
    target_kind: target.kind as AuditTargetKind,
    target_id: target.target_id,
    user_id: options.user_id,
    nodes,
    edges,
    computed_at: options.computed_at ?? '1970-01-01T00:00:00.000Z',
  };
}

interface InternalEvidenceItem {
  kind: EvidenceSourceKind;
  label: string;
  citation_reference?: string;
  source_id?: string;
  confidence: number;
  weight?: number;
}

function targetLabel(t: EvidenceTarget): string {
  switch (t.kind) {
    case 'recommendation_output':
      return `Recommendation for ${t.value.root_goal.inferred_true_goal}`;
    case 'goal_decision_impact':
      return `Impact of "${t.value.decision_label}"`;
    case 'goal_probability_distribution':
      return `Probability distribution @ ${t.value.time_horizon}`;
    case 'catch_up_plan':
      return `Catch-up plan (${t.value.status})`;
    case 'ahead_of_plan_plan':
      return `Ahead-of-plan plan (${t.value.status})`;
    case 'marginal_impact_ranking':
      return `Marginal impact ranking (top ${t.value.ranked.length})`;
  }
}

function targetConfidence(t: EvidenceTarget): number {
  switch (t.kind) {
    case 'recommendation_output':
      return t.value.confidence_score;
    case 'goal_decision_impact':
      return t.value.explanation.confidence;
    case 'goal_probability_distribution':
      return t.value.confidence;
    case 'catch_up_plan':
      return t.value.explanation.confidence;
    case 'ahead_of_plan_plan':
      return t.value.explanation.confidence;
    case 'marginal_impact_ranking':
      return t.value.explanation.confidence;
  }
}

function explanationEvidence(t: EvidenceTarget): InternalEvidenceItem[] {
  switch (t.kind) {
    case 'recommendation_output': {
      const ev = t.value.supporting_evidence ?? [];
      return ev.map((e) => ({
        kind: e.kind as EvidenceSourceKind,
        label: e.label,
        citation_reference: e.citation_reference,
        confidence: e.confidence,
        weight: 1.0,
      }));
    }
    case 'goal_decision_impact':
      return t.value.explanation.evidence.map(mapEv);
    case 'goal_probability_distribution':
      return t.value.explanation.evidence.map(mapEv);
    case 'catch_up_plan':
      return t.value.explanation.evidence.map(mapEv);
    case 'ahead_of_plan_plan':
      return t.value.explanation.evidence.map(mapEv);
    case 'marginal_impact_ranking':
      return t.value.explanation.evidence.map(mapEv);
  }
}

function mapEv(e: {
  label: string;
  source: string;
  citation_reference?: string;
  confidence: number;
}): InternalEvidenceItem {
  return {
    kind: e.source as EvidenceSourceKind,
    label: e.label,
    citation_reference: e.citation_reference,
    confidence: e.confidence,
    weight: 1.0,
  };
}

function targetSpecificEvidence(t: EvidenceTarget): InternalEvidenceItem[] {
  const out: InternalEvidenceItem[] = [];
  switch (t.kind) {
    case 'recommendation_output': {
      const r = t.value;
      if (r.historical_effectiveness) {
        out.push({
          kind: 'pathway_effectiveness',
          label: `${r.historical_effectiveness.pathway_label} (n=${r.historical_effectiveness.sample_size})`,
          confidence: r.historical_effectiveness.confidence ?? 0.5,
          weight: 0.9,
        });
      }
      if (r.confidence_calibrated != null) {
        out.push({
          kind: 'calibration_history',
          label: `Calibrated confidence ${(r.confidence_calibrated * 100).toFixed(0)}%`,
          confidence: r.confidence_calibrated,
          weight: 0.8,
        });
      }
      for (const a of r.required_actions.slice(0, 3)) {
        for (const id of a.related_central_entity_ids?.slice(0, 1) ?? []) {
          out.push({
            kind: 'central_ontology',
            label: a.title,
            source_id: id,
            confidence: a.expected_strength ?? 0.5,
            weight: 1.0,
          });
        }
      }
      break;
    }
    case 'goal_decision_impact':
      out.push({
        kind: 'assumption',
        label: t.value.is_structural ? 'structural compounding' : 'horizon dampening',
        confidence: 0.8,
        weight: 0.9,
      });
      break;
    case 'goal_probability_distribution':
      for (const vf of t.value.explanation.variance_factors.slice(0, 3)) {
        out.push({
          kind: 'assumption',
          label: vf.label,
          confidence: vf.confidence,
          weight: Math.abs(vf.effect),
        });
      }
      break;
    case 'catch_up_plan':
      for (const a of t.value.catch_up_actions.slice(0, 2)) {
        out.push({
          kind: 'user_capability',
          label: `${a.domain}: ${a.description}`,
          confidence: a.feasibility,
          weight: 1.0,
        });
      }
      break;
    case 'ahead_of_plan_plan':
      out.push({
        kind: 'user_capability',
        label: `${t.value.recommended_default.domain}: ${t.value.recommended_default.description}`,
        confidence: 0.7,
        weight: 1.0,
      });
      break;
    case 'marginal_impact_ranking':
      for (const r of t.value.ranked.slice(0, 3)) {
        out.push({
          kind: 'central_ontology',
          label: r.decision_label_canonical,
          confidence: r.confidence,
          weight: Math.abs(r.marginal_impact),
        });
      }
      break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Persistence — bulk insert evidence_links
// ---------------------------------------------------------------------------

export async function persistEvidenceLinks(
  supabase: SupabaseClient,
  userId: string,
  target_kind: AuditTargetKind,
  target_id: string | undefined,
  graph: EvidenceGraph,
  audit_id?: string
): Promise<number> {
  const sb = supabase as any;
  const rows = graph.nodes
    .filter((n) => n.kind !== 'self_report') // skip the root marker
    .map((n) => ({
      user_id: userId,
      audit_id: audit_id ?? null,
      target_kind,
      target_id: target_id ?? null,
      source_kind: n.kind,
      source_id: n.source_id ?? null,
      source_label: n.label,
      citation_reference: n.citation_reference ?? null,
      confidence: n.confidence,
      weight: n.weight,
    }));
  if (rows.length === 0) return 0;
  await sb.from('evidence_links').insert(rows);
  return rows.length;
}

export const __test = { buildEvidenceGraph };
