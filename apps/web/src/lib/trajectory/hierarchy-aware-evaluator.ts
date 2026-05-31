/**
 * HierarchyAwareEvaluator
 *
 * Bolt-on, non-invasive layer that scores a `ProjectorOutput` against a
 * user's `GoalPathway`. Lets the simulation engine answer the only
 * question that actually matters: "which scenario reaches the root
 * goal fastest, given my real hierarchy of supporting and blocking
 * goals?"
 *
 * Inputs:
 *   - `ProjectorOutput`  : one projected scenario from /lib/trajectory
 *   - `GoalPathway`      : output of GoalPathService (this user's hierarchy)
 *   - `goalLookup`       : id -> {title, category} so we can map goals
 *                          to projector metrics
 *
 * Output: `HierarchyAwareScore` containing per-goal advance + a single
 * scalar score for ranking, and a list of explanatory notes.
 *
 * Pure — no I/O — same convention as projector.ts. The API route
 * persists the score into `life_scenario_outputs.metadata.hierarchy_score`.
 */

import type { ProjectorOutput } from '@/types/trajectory';
import type { GoalPathway, PathwayNode } from '@/types/goal-hierarchy';

export interface GoalLookupEntry {
  goal_id: string;
  title: string;
  category?: string | null;
  target_amount?: number | null;
}

export interface GoalAdvance {
  goal_id: string;
  classification: PathwayNode['classification'];
  metric: keyof MetricMap | 'unknown';
  start_value: number;
  end_value: number;
  delta: number;
  normalized_advance: number; // -1..+1
  weighted_contribution: number; // normalized_advance × strength × confidence
}

export interface HierarchyAwareScore {
  scenario_score: number; // -1..+1 (higher = better)
  root_goal_advance: number; // proxy for "progress toward root"
  required_advance: number;
  supporting_advance: number;
  blocked_penalty: number;
  per_goal: GoalAdvance[];
  notes: string[];
}

// ---------------------------------------------------------------------------
// Goal → projector-metric mapping
//
// The projector emits domain-level metrics, not goal-level progress.
// We need a heuristic to decide which metric represents "advance" for
// each personal goal. Categories first; then keyword search on title.
// ---------------------------------------------------------------------------

type MetricKey =
  | 'net_worth'
  | 'cash'
  | 'taxable_investments'
  | 'retirement_balance'
  | 'hsa_balance'
  | 'total_debt'
  | 'emergency_months'
  | 'annual_income'
  | 'monthly_cash_flow'
  | 'health_cost_exposure';

type MetricMap = Record<MetricKey, number>;

const CATEGORY_TO_METRIC: Record<string, { metric: MetricKey; direction: 'up' | 'down' }> = {
  retirement: { metric: 'retirement_balance', direction: 'up' },
  protection: { metric: 'emergency_months', direction: 'up' },
  purchase: { metric: 'cash', direction: 'up' },
  wealth: { metric: 'net_worth', direction: 'up' },
  education: { metric: 'taxable_investments', direction: 'up' },
  health: { metric: 'health_cost_exposure', direction: 'down' },
  career: { metric: 'annual_income', direction: 'up' },
  lifestyle: { metric: 'monthly_cash_flow', direction: 'up' },
  custom: { metric: 'net_worth', direction: 'up' },
};

function classifyTitle(
  title: string | undefined
): { metric: MetricKey; direction: 'up' | 'down' } | undefined {
  if (!title) return undefined;
  const t = title.toLowerCase();
  if (/debt|loan|payoff/.test(t)) return { metric: 'total_debt', direction: 'down' };
  if (/emergency|safety net|reserve/.test(t))
    return { metric: 'emergency_months', direction: 'up' };
  if (/retire|401|ira|pension|fi\b/.test(t))
    return { metric: 'retirement_balance', direction: 'up' };
  if (/invest|portfolio|brokerage|stock/.test(t))
    return { metric: 'taxable_investments', direction: 'up' };
  if (/home|house|down payment|mortgage/.test(t)) return { metric: 'cash', direction: 'up' };
  if (/income|salary|raise|promotion/.test(t)) return { metric: 'annual_income', direction: 'up' };
  if (/health|fitness|sleep|cardio/.test(t))
    return { metric: 'health_cost_exposure', direction: 'down' };
  if (/hsa|medical/.test(t)) return { metric: 'hsa_balance', direction: 'up' };
  if (/cash flow|surplus|budget/.test(t)) return { metric: 'monthly_cash_flow', direction: 'up' };
  return undefined;
}

function mapping(goal: GoalLookupEntry): {
  metric: MetricKey | 'unknown';
  direction: 'up' | 'down';
} {
  const fromCat = goal.category ? CATEGORY_TO_METRIC[goal.category] : undefined;
  if (fromCat) return fromCat;
  const fromTitle = classifyTitle(goal.title);
  if (fromTitle) return fromTitle;
  return { metric: 'unknown', direction: 'up' };
}

// ---------------------------------------------------------------------------
// Score one goal: returns normalized advance in [-1, 1]. Positive = goal
// moved in the desired direction; negative = moved against.
// ---------------------------------------------------------------------------

function pickValue(p: ProjectorOutput['metrics'][number], k: MetricKey): number {
  return Number((p as unknown as Record<string, number>)[k] ?? 0);
}

function normalize(
  start: number,
  end: number,
  target?: number | null,
  direction: 'up' | 'down' = 'up'
): number {
  // If the projector start/end are both zero (the metric isn't tracked
  // for this scenario) we cannot say anything.
  if (start === 0 && end === 0) return 0;
  const delta = end - start;
  if (direction === 'down') {
    // For "down" goals (debt, health_cost_exposure) progress = reduction.
    if (delta >= 0) return Math.max(-1, -(delta / Math.max(1, Math.abs(start))));
    return Math.min(1, -delta / Math.max(1, Math.abs(start)));
  }
  // "up" goals (net worth, retirement, etc.)
  if (target && target > 0) {
    return Math.max(-1, Math.min(1, delta / target));
  }
  return Math.max(-1, Math.min(1, delta / Math.max(1, Math.abs(start) || end || 1)));
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export interface EvaluatorOptions {
  /** Per-class weights. Defaults to required > root > supporting > blocked penalty. */
  weights?: {
    root?: number;
    required?: number;
    supporting?: number;
    blocked?: number;
  };
}

const DEFAULT_WEIGHTS = { root: 0.4, required: 0.3, supporting: 0.2, blocked: 0.1 };

export function evaluate(
  projection: ProjectorOutput,
  pathway: GoalPathway,
  goalLookup: GoalLookupEntry[],
  options: EvaluatorOptions = {}
): HierarchyAwareScore {
  const W = { ...DEFAULT_WEIGHTS, ...(options.weights ?? {}) };
  const byId = new Map(goalLookup.map((g) => [g.goal_id, g]));
  const start = projection.metrics[0];
  const end = projection.metrics[projection.metrics.length - 1];
  if (!start || !end) {
    return {
      scenario_score: 0,
      root_goal_advance: 0,
      required_advance: 0,
      supporting_advance: 0,
      blocked_penalty: 0,
      per_goal: [],
      notes: ['projector produced no metric points'],
    };
  }

  const allNodes: Array<{
    node: PathwayNode | { goal_id: string; classification: 'root'; cumulative_strength: 1 };
    classification: PathwayNode['classification'] | 'root';
  }> = [
    {
      node: { goal_id: pathway.root_goal_id, classification: 'root', cumulative_strength: 1 },
      classification: 'root',
    },
    ...pathway.required.map((n) => ({ node: n, classification: 'required' as const })),
    ...pathway.supporting.map((n) => ({ node: n, classification: 'supporting' as const })),
    ...pathway.blocked.map((n) => ({ node: n, classification: 'blocked' as const })),
  ];

  const per_goal: GoalAdvance[] = [];
  const notes: string[] = [];
  let sumRoot = 0,
    sumReq = 0,
    sumSup = 0,
    sumBlk = 0;
  let nReq = 0,
    nSup = 0,
    nBlk = 0;

  for (const { node, classification } of allNodes) {
    const meta = byId.get(node.goal_id);
    if (!meta) {
      notes.push(`No goal metadata for ${node.goal_id} — skipped`);
      continue;
    }
    const m = mapping(meta);
    if (m.metric === 'unknown') {
      notes.push(`No metric mapping for "${meta.title}" — skipped`);
      per_goal.push({
        goal_id: node.goal_id,
        classification,
        metric: 'unknown',
        start_value: 0,
        end_value: 0,
        delta: 0,
        normalized_advance: 0,
        weighted_contribution: 0,
      });
      continue;
    }
    const s = pickValue(start, m.metric);
    const e = pickValue(end, m.metric);
    const norm = normalize(s, e, meta.target_amount ?? undefined, m.direction);
    const strength = 'cumulative_strength' in node ? node.cumulative_strength : 1;
    const contribution = norm * strength;
    per_goal.push({
      goal_id: node.goal_id,
      classification,
      metric: m.metric,
      start_value: s,
      end_value: e,
      delta: e - s,
      normalized_advance: norm,
      weighted_contribution: contribution,
    });
    if (classification === 'root') sumRoot += contribution;
    else if (classification === 'required') {
      sumReq += contribution;
      nReq += 1;
    } else if (classification === 'supporting') {
      sumSup += contribution;
      nSup += 1;
    } else if (classification === 'blocked') {
      sumBlk += contribution;
      nBlk += 1;
    }
  }

  const required_advance = nReq ? sumReq / nReq : 0;
  const supporting_advance = nSup ? sumSup / nSup : 0;
  const blocked_penalty = nBlk ? Math.max(0, sumBlk / nBlk) : 0; // penalize *advancing* blockers

  const scenario_score =
    W.root * sumRoot +
    W.required * required_advance +
    W.supporting * supporting_advance -
    W.blocked * blocked_penalty;

  return {
    scenario_score: Math.max(-1, Math.min(1, scenario_score)),
    root_goal_advance: sumRoot,
    required_advance,
    supporting_advance,
    blocked_penalty,
    per_goal,
    notes,
  };
}

/**
 * Rank a set of scenarios. Returns them sorted by hierarchy score
 * descending, with their original index preserved for callers.
 */
export interface RankedScenario<T extends { id: string }> {
  scenario: T;
  score: HierarchyAwareScore;
  rank: number;
}

export function rankScenarios<T extends { id: string }>(
  scenarios: Array<{ scenario: T; projection: ProjectorOutput }>,
  pathway: GoalPathway,
  goalLookup: GoalLookupEntry[],
  options: EvaluatorOptions = {}
): RankedScenario<T>[] {
  const scored = scenarios.map(({ scenario, projection }) => ({
    scenario,
    score: evaluate(projection, pathway, goalLookup, options),
  }));
  scored.sort((a, b) => b.score.scenario_score - a.score.scenario_score);
  return scored.map((s, idx) => ({ ...s, rank: idx + 1 }));
}
