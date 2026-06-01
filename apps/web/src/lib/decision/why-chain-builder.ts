/**
 * WhyChainBuilder — DETERMINISTIC.
 *
 * Given any decision-engine output (RecommendationOutput, DecisionImpact,
 * ProbabilityDistribution, CatchUpPlan, AheadOfPlanPlan,
 * MarginalImpactRanking), produce a tree of "claim → because →
 * because" nodes the user can walk.
 *
 * The chain is computed from the structured output payload itself + a
 * stable id derivation rule. The SAME input ALWAYS produces the SAME
 * output (no random ids, no LLM in the loop, no walltime in the body).
 * This is the determinism contract that makes the trust APIs
 * answerable.
 *
 * Recursion is capped at `max_depth` (default 5) so the chain stays
 * walkable in the UI.
 */

import type { AuditTargetKind, WhyChain, WhyChainEdge, WhyChainNode } from '@/types/xai';
import type {
  CatchUpPlan,
  AheadOfPlanPlan,
  DecisionImpact,
  MarginalImpactRanking,
  ProbabilityDistribution,
} from '@/types/decision-impact';
import type { RecommendationOutput } from '@/types/advisor';

const DEFAULT_MAX_DEPTH = 5;

// ---------------------------------------------------------------------------
// Public union
// ---------------------------------------------------------------------------

export type WhyChainTarget =
  | { kind: 'recommendation_output'; value: RecommendationOutput; target_id?: string }
  | { kind: 'goal_decision_impact'; value: DecisionImpact; target_id?: string }
  | { kind: 'goal_probability_distribution'; value: ProbabilityDistribution; target_id?: string }
  | { kind: 'catch_up_plan'; value: CatchUpPlan; target_id?: string }
  | { kind: 'ahead_of_plan_plan'; value: AheadOfPlanPlan; target_id?: string }
  | { kind: 'marginal_impact_ranking'; value: MarginalImpactRanking; target_id?: string };

export interface BuildWhyChainOptions {
  user_id: string;
  max_depth?: number;
  /** Frozen timestamp so the same input produces the same output even
   *  across compute time. Defaults to `'1970-01-01T00:00:00.000Z'` so
   *  tests can assert byte equality. Callers wanting a real timestamp
   *  should set this to `new Date().toISOString()`. */
  computed_at?: string;
}

// ---------------------------------------------------------------------------
// Pure entrypoint
// ---------------------------------------------------------------------------

export function buildWhyChain(target: WhyChainTarget, options: BuildWhyChainOptions): WhyChain {
  const max_depth = options.max_depth ?? DEFAULT_MAX_DEPTH;
  const ctx: BuilderContext = {
    user_id: options.user_id,
    max_depth,
    nodes: [],
    edges: [],
    seen: new Set<string>(),
  };

  switch (target.kind) {
    case 'recommendation_output':
      buildForRecommendation(target.value, undefined, 0, ctx);
      break;
    case 'goal_decision_impact':
      buildForDecisionImpact(target.value, undefined, 0, ctx);
      break;
    case 'goal_probability_distribution':
      buildForProbabilityDistribution(target.value, undefined, 0, ctx);
      break;
    case 'catch_up_plan':
      buildForCatchUp(target.value, undefined, 0, ctx);
      break;
    case 'ahead_of_plan_plan':
      buildForAhead(target.value, undefined, 0, ctx);
      break;
    case 'marginal_impact_ranking':
      buildForRanker(target.value, undefined, 0, ctx);
      break;
  }

  return {
    target_kind: target.kind as AuditTargetKind,
    target_id: target.target_id,
    user_id: options.user_id,
    nodes: ctx.nodes,
    edges: ctx.edges,
    max_depth,
    computed_at: options.computed_at ?? '1970-01-01T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// Builder state
// ---------------------------------------------------------------------------

interface BuilderContext {
  user_id: string;
  max_depth: number;
  nodes: WhyChainNode[];
  edges: WhyChainEdge[];
  seen: Set<string>;
}

function nodeId(parts: Array<string | number | undefined>): string {
  return parts.filter((p) => p !== undefined).join('::');
}

function pushNode(
  ctx: BuilderContext,
  node: WhyChainNode,
  parentId?: string,
  label: WhyChainEdge['label'] = 'because'
): WhyChainNode {
  if (!ctx.seen.has(node.id)) {
    ctx.nodes.push(node);
    ctx.seen.add(node.id);
  }
  if (parentId) {
    const edgeKey = `${parentId}->${node.id}::${label}`;
    if (!ctx.seen.has(edgeKey)) {
      ctx.edges.push({ parent_node_id: parentId, child_node_id: node.id, label });
      ctx.seen.add(edgeKey);
    }
  }
  return node;
}

// ---------------------------------------------------------------------------
// Per-target chains
// ---------------------------------------------------------------------------

function buildForRecommendation(
  rec: RecommendationOutput,
  parentId: string | undefined,
  depth: number,
  ctx: BuilderContext
): WhyChainNode {
  const root = pushNode(
    ctx,
    {
      id: nodeId(['rec', rec.root_goal.inferred_true_goal]),
      depth,
      claim: `Recommendation aims to advance: ${rec.root_goal.inferred_true_goal}`,
      confidence: rec.confidence_score,
      grounded_in: {
        kind: 'goal_progress_snapshot',
        label: `root_goal.source=${rec.root_goal.source}`,
      },
    },
    parentId
  );

  if (depth >= ctx.max_depth) return root;

  // First-level: top action.
  const top = rec.required_actions[0];
  if (top) {
    const topNode = pushNode(
      ctx,
      {
        id: nodeId(['rec_top_action', top.id]),
        depth: depth + 1,
        claim: `Top required action: ${top.title}`,
        confidence: top.expected_strength ?? rec.confidence_score,
        grounded_in: {
          kind: 'central_ontology',
          label: top.related_central_entity_ids?.[0] ?? 'central edge',
        },
      },
      root.id
    );
    // Second-level: rationale.
    if (depth + 2 <= ctx.max_depth) {
      pushNode(
        ctx,
        {
          id: nodeId(['rec_top_action_rationale', top.id]),
          depth: depth + 2,
          claim: `Rationale: ${top.rationale}`,
          confidence: top.expected_strength ?? rec.confidence_score,
        },
        topNode.id,
        'supported_by'
      );
    }
  }

  // Pathway grounding.
  if (rec.pathway_label) {
    const pathNode = pushNode(
      ctx,
      {
        id: nodeId(['rec_pathway', rec.pathway_label]),
        depth: depth + 1,
        claim: `Pathway: ${rec.pathway_label}`,
        confidence: rec.historical_effectiveness?.confidence ?? rec.confidence_score,
        grounded_in: { kind: 'pathway_effectiveness', label: rec.pathway_label },
      },
      root.id,
      'in_context_of'
    );
    if (rec.historical_effectiveness && depth + 2 < ctx.max_depth) {
      pushNode(
        ctx,
        {
          id: nodeId(['rec_pathway_history', rec.pathway_label]),
          depth: depth + 2,
          claim: `Historical effectiveness: n=${rec.historical_effectiveness.sample_size}, success_rate=${(rec.historical_effectiveness.success_rate ?? 0).toFixed(2)} (${rec.historical_effectiveness.scope})`,
          confidence: rec.historical_effectiveness.confidence ?? 0.5,
          grounded_in: {
            kind: 'pathway_effectiveness',
            label: rec.historical_effectiveness.pathway_label,
          },
        },
        pathNode.id,
        'supported_by'
      );
    }
  }

  // Confidence calibration grounding.
  if (rec.confidence_calibrated != null && rec.confidence_calibrated !== rec.confidence_score) {
    pushNode(
      ctx,
      {
        id: nodeId(['rec_calibration', rec.confidence_calibrated.toFixed(3)]),
        depth: depth + 1,
        claim: `Calibrated confidence ${(rec.confidence_calibrated * 100).toFixed(0)}% based on your historical accuracy.`,
        confidence: rec.confidence_calibrated,
        grounded_in: { kind: 'calibration_history', label: 'prediction_calibration' },
      },
      root.id,
      'supported_by'
    );
  }

  // Supporting evidence (top 3 by confidence).
  const ev = (rec.supporting_evidence ?? [])
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  for (const e of ev) {
    pushNode(
      ctx,
      {
        id: nodeId(['rec_ev', e.kind, e.label]),
        depth: depth + 1,
        claim: `Evidence (${e.kind}): ${e.label}`,
        confidence: e.confidence,
        grounded_in: {
          kind: e.kind as
            | 'central_ontology'
            | 'personal_history'
            | 'pathway_effectiveness'
            | 'recommendation_quality',
          label: e.label,
          citation_reference: e.citation_reference,
          source_id: e.central_entity_id,
        },
      },
      root.id,
      'supported_by'
    );
  }

  // Blocked goals: surface as a "why constrained" branch.
  if (rec.blocked_goals.length > 0) {
    pushNode(
      ctx,
      {
        id: nodeId(['rec_blocked']),
        depth: depth + 1,
        claim: `${rec.blocked_goals.length} goal(s) currently block this; addressing them lifts the ceiling.`,
        confidence: 0.7,
        grounded_in: { kind: 'goal_hierarchy_edge', label: 'blocked_goals' },
      },
      root.id,
      'depends_on'
    );
  }

  return root;
}

function buildForDecisionImpact(
  impact: DecisionImpact,
  parentId: string | undefined,
  depth: number,
  ctx: BuilderContext
): WhyChainNode {
  const root = pushNode(
    ctx,
    {
      id: nodeId(['impact', impact.decision_label]),
      depth,
      claim: `Decision "${impact.decision_label}" changes ${impact.goal_id ? 'goal' : 'target'} probability over time.`,
      confidence: impact.explanation.confidence,
    },
    parentId
  );

  if (depth >= ctx.max_depth) return root;

  // Structural classification.
  pushNode(
    ctx,
    {
      id: nodeId(['impact_structural', impact.decision_label]),
      depth: depth + 1,
      claim: impact.is_structural
        ? `Treated as STRUCTURAL (variable=${impact.structural_variable ?? 'unspecified'}); long-horizon impact compounds.`
        : `Treated as non-structural; impact peaks then dampens with horizon.`,
      confidence: 0.85,
      grounded_in: { kind: 'assumption', label: 'horizon-dampening model' },
    },
    root.id,
    'because'
  );

  // Per-horizon points (top 3 by absolute delta).
  const ranked = impact.per_horizon
    .slice()
    .sort((a, b) => Math.abs(b.probability_delta) - Math.abs(a.probability_delta))
    .slice(0, 3);
  for (const h of ranked) {
    pushNode(
      ctx,
      {
        id: nodeId(['impact_horizon', impact.decision_label, h.time_horizon]),
        depth: depth + 1,
        claim: `${h.time_horizon}: ${h.probability_delta >= 0 ? '+' : ''}${(h.probability_delta * 100).toFixed(0)}% (confidence ${(h.confidence * 100).toFixed(0)}%)`,
        confidence: h.confidence,
      },
      root.id,
      'supported_by'
    );
  }

  // Related goals branch.
  for (const r of impact.related_goal_effects.slice(0, 3)) {
    pushNode(
      ctx,
      {
        id: nodeId(['impact_related', impact.decision_label, r.goal_id]),
        depth: depth + 1,
        claim: `Related goal ${r.goal_id} also moves by ${(r.delta * 100).toFixed(0)}%.`,
        confidence: 0.7,
        grounded_in: { kind: 'goal_hierarchy_edge', label: 'related_goal' },
      },
      root.id,
      'because'
    );
  }

  return root;
}

function buildForProbabilityDistribution(
  dist: ProbabilityDistribution,
  parentId: string | undefined,
  depth: number,
  ctx: BuilderContext
): WhyChainNode {
  const root = pushNode(
    ctx,
    {
      id: nodeId(['prob', dist.goal_id, dist.time_horizon]),
      depth,
      claim: `At ${dist.time_horizon}, most-likely probability is ${(dist.most_likely * 100).toFixed(0)}% (range ${(dist.worst_case * 100).toFixed(0)}–${(dist.best_case * 100).toFixed(0)}%).`,
      confidence: dist.confidence,
    },
    parentId
  );

  if (depth >= ctx.max_depth) return root;

  // Variance factors as "because" reasons.
  for (const v of dist.explanation.variance_factors.slice(0, 4)) {
    pushNode(
      ctx,
      {
        id: nodeId(['prob_var', dist.goal_id, dist.time_horizon, v.kind, v.label]),
        depth: depth + 1,
        claim: `${v.label} (${v.effect >= 0 ? 'narrows' : 'widens'} range by ${Math.abs(v.effect).toFixed(2)})`,
        confidence: v.confidence,
        grounded_in: { kind: 'assumption', label: v.kind },
      },
      root.id,
      'because'
    );
  }

  return root;
}

function buildForCatchUp(
  plan: CatchUpPlan,
  parentId: string | undefined,
  depth: number,
  ctx: BuilderContext
): WhyChainNode {
  const root = pushNode(
    ctx,
    {
      id: nodeId(['catchup', plan.goal_id]),
      depth,
      claim: `Status: ${plan.status}; gap of ${(plan.gap.delta * 100).toFixed(0)}% to close.`,
      confidence: plan.explanation.confidence,
    },
    parentId
  );

  if (depth >= ctx.max_depth) return root;

  for (const a of plan.catch_up_actions.slice(0, 3)) {
    pushNode(
      ctx,
      {
        id: nodeId(['catchup_action', plan.goal_id, a.description]),
        depth: depth + 1,
        claim: `${a.description}${a.magnitude ? ` (${a.magnitude})` : ''} — expected uplift ${(a.expected_probability_delta * 100).toFixed(1)}%, feasibility ${(a.feasibility * 100).toFixed(0)}%`,
        confidence: a.feasibility,
        grounded_in: { kind: 'user_capability', label: a.domain },
      },
      root.id,
      'because'
    );
  }

  for (const r of plan.risks.slice(0, 2)) {
    pushNode(
      ctx,
      {
        id: nodeId(['catchup_risk', plan.goal_id, r]),
        depth: depth + 1,
        claim: `Risk: ${r}`,
        confidence: 0.6,
        grounded_in: { kind: 'assumption', label: 'risk surface' },
      },
      root.id,
      'in_context_of'
    );
  }

  return root;
}

function buildForAhead(
  plan: AheadOfPlanPlan,
  parentId: string | undefined,
  depth: number,
  ctx: BuilderContext
): WhyChainNode {
  const root = pushNode(
    ctx,
    {
      id: nodeId(['ahead', plan.goal_id]),
      depth,
      claim: `Status: ahead by ${Math.abs(plan.cushion.delta * 100).toFixed(0)}%; default lean is ${plan.recommended_default.kind}.`,
      confidence: plan.explanation.confidence,
    },
    parentId
  );

  if (depth >= ctx.max_depth) return root;

  pushNode(
    ctx,
    {
      id: nodeId(['ahead_default', plan.goal_id, plan.recommended_default.kind]),
      depth: depth + 1,
      claim: `Recommended default: ${plan.recommended_default.description}.`,
      confidence: plan.explanation.confidence,
      grounded_in: { kind: 'user_capability', label: plan.recommended_default.domain },
    },
    root.id,
    'because'
  );

  return root;
}

function buildForRanker(
  ranking: MarginalImpactRanking,
  parentId: string | undefined,
  depth: number,
  ctx: BuilderContext
): WhyChainNode {
  const root = pushNode(
    ctx,
    {
      id: nodeId(['ranking', ranking.user_id]),
      depth,
      claim: `Top ${ranking.ranked.length} highest-marginal-impact decisions identified at horizon=${ranking.ranked[0]?.time_horizon ?? '1_year'}.`,
      confidence: ranking.explanation.confidence,
    },
    parentId
  );

  if (depth >= ctx.max_depth) return root;

  for (const item of ranking.ranked.slice(0, 3)) {
    pushNode(
      ctx,
      {
        id: nodeId(['ranking_item', item.rank.toString(), item.decision_label_canonical]),
        depth: depth + 1,
        claim: `#${item.rank}: ${item.decision} (${(item.marginal_impact * 100).toFixed(0)}% on ${item.target_goal}); ${item.reason}`,
        confidence: item.confidence,
        grounded_in: { kind: 'central_ontology', label: item.decision_label_canonical },
      },
      root.id,
      'because'
    );
  }

  return root;
}

// ---------------------------------------------------------------------------
// Re-exports for tests
// ---------------------------------------------------------------------------
export const __test = {
  buildForRecommendation,
  buildForDecisionImpact,
  buildForProbabilityDistribution,
  buildForCatchUp,
  buildForAhead,
  buildForRanker,
};
