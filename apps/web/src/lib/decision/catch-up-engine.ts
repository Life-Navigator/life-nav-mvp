/**
 * CatchUpEngine
 *
 * If the user is behind trajectory, identify the smallest realistic
 * set of actions that closes the gap. "Realistic" = respects
 * declared constraints, available surplus, commitment hours, health
 * recovery capacity, and risk tolerance.
 *
 * Pure function: input shape → CatchUpPlan. Persistence is handled by
 * a thin wrapper at the API route.
 */

import { computeProbabilityDistribution } from './probability-engine';
import type {
  CatchUpAction,
  CatchUpPlan,
  CatchUpStatus,
  DomainKey,
  TimeHorizon,
  XAIExplanation,
} from '@/types/decision-impact';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface CatchUpInputs {
  goal_id: string;
  goal_concept?: string;
  /** Target trajectory score at `target_at`. */
  target_score: number;
  /** Actual current score (goal_progress_snapshot). */
  current_score: number;
  /** Target date (months from now). */
  target_at_months: number;
  /** Goal priority — 'essential' | 'important' | 'nice_to_have'. */
  priority?: 'essential' | 'important' | 'nice_to_have';
  /** Available monthly surplus, USD. */
  available_surplus_usd?: number;
  /** Commitment hours per week per relevant domain (from user_commitment_levels). */
  commitment_hours_per_week?: number;
  /** 0..1 — overall health/recovery capacity (1 = full, 0 = depleted). */
  health_recovery_capacity?: number;
  /** 0..1 — risk tolerance. */
  risk_tolerance?: number;
  /** Hard-constraint count for tradeoff narration. */
  hard_constraint_count?: number;
  /** Domains the goal touches. Required to pick relevant action templates. */
  domains: DomainKey[];
  /** Per-horizon historical accuracy (used by downstream probability engine). */
  historical_accuracy_mean?: number;
  /** Optional pathway effectiveness lookup result. */
  pathway_effectiveness?: { sample_size: number; success_rate?: number; confidence?: number };
}

// ---------------------------------------------------------------------------
// Status classifier
// ---------------------------------------------------------------------------

export function classifyStatus(inputs: {
  current_score: number;
  target_score: number;
  priority?: string;
}): CatchUpStatus {
  const gap = inputs.target_score - inputs.current_score;
  // Thresholds are inclusive on the "ahead" / "on_track" sides so that
  // exact 0.10 cushions are not lost to floating-point error.
  if (gap < -0.05) return 'ahead';
  if (gap <= 0.05) return 'on_track';
  // Essential goals tip into 'at_risk' faster than the others.
  const atRiskThreshold = inputs.priority === 'essential' ? 0.15 : 0.25;
  return gap >= atRiskThreshold ? 'at_risk' : 'behind';
}

// ---------------------------------------------------------------------------
// Catch-up action catalog
// ---------------------------------------------------------------------------

const ACTION_CATALOG: Record<
  DomainKey,
  Array<
    Omit<CatchUpAction, 'feasibility' | 'expected_probability_delta'> & {
      base_delta: number;
      cost_usd?: number;
      hours?: number;
      risk?: number;
    }
  >
> = {
  financial: [
    {
      domain: 'financial',
      description: 'Increase monthly savings by $400',
      magnitude: '+$400/month',
      base_delta: 0.08,
      cost_usd: 400,
    },
    {
      domain: 'financial',
      description: 'Reduce discretionary spending by 8%',
      magnitude: '-8% discretionary',
      base_delta: 0.05,
    },
    {
      domain: 'financial',
      description: 'Delay home purchase by 6 months',
      magnitude: '-6 months timeline',
      base_delta: 0.1,
    },
    {
      domain: 'financial',
      description: 'Increase income by $10k/year',
      magnitude: '+$10k/year',
      base_delta: 0.14,
      hours: 5,
      risk: 0.3,
    },
  ],
  health: [
    {
      domain: 'health',
      description: 'Add 2 weekly Zone 2 sessions',
      magnitude: '+2 sessions/week',
      base_delta: 0.08,
      hours: 3,
    },
    {
      domain: 'health',
      description: 'Improve protein adherence',
      magnitude: '+0.4 g/kg target',
      base_delta: 0.05,
    },
    {
      domain: 'health',
      description: 'Improve sleep consistency',
      magnitude: '+1h average',
      base_delta: 0.06,
    },
    {
      domain: 'health',
      description: 'Reduce injury risk before load increase',
      magnitude: 'deload week',
      base_delta: 0.04,
      risk: -0.2,
    },
  ],
  career: [
    {
      domain: 'career',
      description: 'Complete certification by Q3',
      magnitude: '1 credential',
      base_delta: 0.1,
      hours: 6,
      risk: 0.2,
    },
    {
      domain: 'career',
      description: 'Apply to 8 roles/month',
      magnitude: '8/month',
      base_delta: 0.07,
      hours: 5,
    },
    {
      domain: 'career',
      description: 'Request promotion conversation',
      magnitude: 'manager 1:1',
      base_delta: 0.06,
    },
  ],
  education: [
    {
      domain: 'education',
      description: 'Increase study hours by 4/week',
      magnitude: '+4h/week',
      base_delta: 0.06,
      hours: 4,
    },
    {
      domain: 'education',
      description: 'Switch to lower-cost credential',
      magnitude: 'alt credential',
      base_delta: 0.04,
    },
    {
      domain: 'education',
      description: 'Use employer reimbursement',
      magnitude: 'employer benefit',
      base_delta: 0.05,
    },
  ],
  insurance: [
    {
      domain: 'insurance',
      description: 'Re-shop term-life coverage',
      magnitude: '~$25/mo savings',
      base_delta: 0.02,
    },
    {
      domain: 'insurance',
      description: 'Add umbrella policy',
      magnitude: '$1M umbrella',
      base_delta: 0.03,
      risk: -0.3,
    },
  ],
  benefits: [
    {
      domain: 'benefits',
      description: 'Max employer 401(k) match',
      magnitude: 'full match',
      base_delta: 0.07,
    },
    {
      domain: 'benefits',
      description: 'Enroll in HSA + LP-FSA combo',
      magnitude: 'tax-advantaged',
      base_delta: 0.04,
    },
  ],
  estate: [
    {
      domain: 'estate',
      description: 'Complete will + healthcare POA',
      magnitude: '2 documents',
      base_delta: 0.03,
    },
    {
      domain: 'estate',
      description: 'Set up revocable living trust',
      magnitude: 'trust',
      base_delta: 0.04,
    },
  ],
  entrepreneurship: [
    {
      domain: 'entrepreneurship',
      description: 'Validate side-business idea',
      magnitude: '4-week sprint',
      base_delta: 0.05,
      hours: 5,
      risk: 0.4,
    },
    {
      domain: 'entrepreneurship',
      description: 'Build 6-month operating reserve',
      magnitude: '6 months',
      base_delta: 0.06,
      cost_usd: 1000,
    },
  ],
  family: [
    {
      domain: 'family',
      description: 'Renegotiate childcare hours',
      magnitude: 'family rebalance',
      base_delta: 0.03,
      hours: -2,
    },
  ],
};

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

export function computeCatchUpPlan(inputs: CatchUpInputs): CatchUpPlan {
  const gap = clamp(inputs.target_score - inputs.current_score, -1, 1);
  const status = classifyStatus(inputs);

  // Build candidate action list from the relevant domains.
  const candidates: CatchUpAction[] = [];
  for (const d of inputs.domains) {
    const templates = ACTION_CATALOG[d] ?? [];
    for (const t of templates) {
      const feasibility = computeFeasibility(t, inputs);
      // Discount delta by feasibility — infeasible actions get small expected impact.
      const expected_probability_delta = t.base_delta * feasibility;
      candidates.push({
        domain: t.domain,
        description: t.description,
        magnitude: t.magnitude,
        expected_probability_delta,
        feasibility,
      });
    }
  }

  // Greedy selection: pick highest-delta actions until cumulative delta ≥ gap (or we run out).
  candidates.sort((a, b) => b.expected_probability_delta - a.expected_probability_delta);
  const selected: CatchUpAction[] = [];
  let cumulative = 0;
  for (const c of candidates) {
    if (cumulative >= gap) break;
    if (c.feasibility < 0.25) continue;
    selected.push(c);
    cumulative += c.expected_probability_delta;
  }
  // Never recommend fewer than 1 action when behind.
  if (
    selected.length === 0 &&
    status !== 'on_track' &&
    status !== 'ahead' &&
    candidates.length > 0
  ) {
    selected.push(candidates[0]);
  }

  // Project probability after catch-up.
  const probability_after_catch_up = clamp01(inputs.current_score + cumulative);

  const horizon = targetMonthsToHorizon(inputs.target_at_months);
  const dist = computeProbabilityDistribution(
    {
      goal_id: inputs.goal_id,
      goal_concept: inputs.goal_concept,
      current_progress: probability_after_catch_up,
      historical_accuracy_mean: inputs.historical_accuracy_mean,
      hard_constraint_count: inputs.hard_constraint_count,
      pathway_effectiveness: inputs.pathway_effectiveness,
      risk_tolerance_score: inputs.risk_tolerance,
      domains: inputs.domains,
    },
    horizon
  );

  const minimum_required_change =
    selected.length > 0
      ? `Closing the ${(gap * 100).toFixed(0)}% gap requires committing to: ${selected
          .slice(0, 2)
          .map((a) => a.description)
          .join(' + ')}.`
      : 'No catch-up needed at this time.';

  const recommended_plan =
    selected.length === 0
      ? 'Stay the course; you are on or ahead of trajectory.'
      : selected
          .map(
            (a, i) =>
              `${i + 1}. ${a.description}${a.magnitude ? ` (${a.magnitude})` : ''} — ${(a.expected_probability_delta * 100).toFixed(1)}% expected uplift.`
          )
          .join('\n');

  // Tradeoffs + risks
  const tradeoffs: CatchUpPlan['tradeoffs'] = [];
  if (selected.some((s) => s.domain === 'financial' && /spending/i.test(s.description))) {
    tradeoffs.push({
      summary: 'Reducing discretionary spending lowers near-term quality of life.',
      gives_up: 'discretionary flexibility',
      gains: 'savings rate uplift',
    });
  }
  if (selected.some((s) => s.domain === 'career' || s.domain === 'entrepreneurship')) {
    tradeoffs.push({
      summary: 'Effort reallocation toward career/business may reduce family or health time.',
      gives_up: 'rest / family time',
      gains: 'income trajectory uplift',
    });
  }

  const risks: string[] = [];
  if (inputs.health_recovery_capacity != null && inputs.health_recovery_capacity < 0.4) {
    risks.push('Health recovery capacity is low — pushing harder risks burnout.');
  }
  if (selected.length >= 4) {
    risks.push('More than 3 simultaneous changes increase abandonment probability.');
  }
  if (status === 'at_risk') {
    risks.push('Goal is currently at-risk; further slippage may force re-scoping.');
  }

  const explanation: XAIExplanation = {
    assumptions: [
      'Action deltas are template estimates; real impact depends on adherence.',
      'Feasibility scores already account for declared surplus, hours, and risk tolerance.',
      gap > 0.15
        ? 'Large gaps may require structural changes (income or credential) the catalog only partially covers.'
        : '',
    ].filter(Boolean),
    variance_factors: dist.explanation.variance_factors,
    evidence: dist.explanation.evidence,
    confidence: clamp01(0.4 + 0.4 * (inputs.historical_accuracy_mean ?? 0.5)),
    what_would_change_estimate: [
      'A larger declared surplus would unlock higher-delta financial actions.',
      'More commitment hours would unlock career / education / health actions.',
      'A change in risk tolerance would re-rank entrepreneurship / income actions.',
    ],
    related_goals_affected: [],
    domains_affected: inputs.domains,
  };

  return {
    goal_id: inputs.goal_id,
    status,
    gap: {
      current_score: inputs.current_score,
      target_score: inputs.target_score,
      delta: gap,
      months_behind: gap > 0 ? Math.round(inputs.target_at_months * gap) : undefined,
    },
    catch_up_actions: selected,
    minimum_required_change,
    recommended_plan,
    probability_after_catch_up,
    tradeoffs,
    risks,
    explanation,
  };
}

// ---------------------------------------------------------------------------
// Feasibility scoring
// ---------------------------------------------------------------------------

interface CatalogTemplate {
  domain?: DomainKey;
  cost_usd?: number;
  hours?: number;
  risk?: number; // -1..1; positive = riskier
}

function computeFeasibility(t: CatalogTemplate, inputs: CatchUpInputs): number {
  let f = 1.0;
  if (t.cost_usd != null && inputs.available_surplus_usd != null) {
    if (inputs.available_surplus_usd < t.cost_usd) {
      f *= clamp(inputs.available_surplus_usd / t.cost_usd, 0.1, 1);
    }
  }
  if (t.hours != null && t.hours > 0 && inputs.commitment_hours_per_week != null) {
    if (inputs.commitment_hours_per_week < t.hours) {
      f *= clamp(inputs.commitment_hours_per_week / t.hours, 0.1, 1);
    }
  }
  if (t.risk != null && t.risk > 0 && inputs.risk_tolerance != null) {
    if (inputs.risk_tolerance < t.risk) {
      f *= clamp(inputs.risk_tolerance / t.risk, 0.2, 1);
    }
  }
  if (inputs.health_recovery_capacity != null && (t.domain === 'health' || (t.hours ?? 0) > 4)) {
    f *= clamp01(inputs.health_recovery_capacity);
  }
  return clamp01(f);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
function clamp01(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0;
  return clamp(n, 0, 1);
}
function targetMonthsToHorizon(months: number): TimeHorizon {
  if (months <= 3) return 'immediate';
  if (months <= 6) return '3_month';
  if (months <= 18) return '1_year';
  if (months <= 48) return '3_year';
  if (months <= 84) return '5_year';
  if (months <= 180) return '10_year';
  return '20_year';
}

export const __test = { classifyStatus, computeFeasibility, computeCatchUpPlan };
