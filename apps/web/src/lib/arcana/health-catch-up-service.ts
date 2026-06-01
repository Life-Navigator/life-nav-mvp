/**
 * Arcana Health Catch-Up Service (Phase 10)
 *
 * Honest framing: the Arcana catch-up engine NEVER says "start over."
 * It surfaces the smallest realistic recovery — the delta-improvements
 * the user can actually do given their declared constraints, with
 * conservative effect sizes drawn from the catalog.
 *
 * Pure function: same input → byte-identical output (modulo notes).
 */

import { filterCatalogByGoal, HEALTH_CATALOG, materializeAction } from './health-catalog';
import type {
  ArcanaConstraint,
  ArcanaDomain,
  ArcanaGoalKind,
  HealthCatchUpAction,
  HealthCatchUpResult,
  HealthStatus,
} from '@/types/arcana';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface HealthCatchUpInputs {
  goal_kind: ArcanaGoalKind;
  domains_touched: ArcanaDomain[];

  /** Current measured score in [0,1]. */
  current_score: number;
  /** Target score in [0,1]. */
  target_score: number;
  /** Months until target_date (positive). */
  target_at_months: number;

  /** Constraints from arcana_constraints. Used to filter actions. */
  constraints?: ArcanaConstraint[];

  /** Optional readiness signal in [0,1] for downstream notes. */
  readiness_score?: number;

  /** Whether the user has a clearance/cleared status from a provider. */
  has_provider_clearance?: boolean;
}

// ---------------------------------------------------------------------------
// Status classifier — matches Sprint F semantics with the +recovery tier
// ---------------------------------------------------------------------------

export function classifyHealthStatus(inputs: {
  current_score: number;
  target_score: number;
}): HealthStatus {
  const { current_score, target_score } = inputs;
  if (Number.isNaN(current_score) || Number.isNaN(target_score)) return 'unknown';
  // Round to 4 dp to neutralize floating-point drift like 0.15000000000000002.
  const gap = Math.round((target_score - current_score) * 10000) / 10000;
  if (gap <= -0.05) return 'ahead_of_plan';
  if (gap <= 0.05) return 'on_track';
  if (gap <= 0.15) return 'slightly_behind';
  if (gap <= 0.3) return 'meaningfully_behind';
  return 'critically_behind';
}

// ---------------------------------------------------------------------------
// Constraint filter — rule out catalog entries that violate hard constraints
// ---------------------------------------------------------------------------

function violatesConstraint(action: HealthCatchUpAction, c: ArcanaConstraint): boolean {
  if (!c.is_active || c.severity !== 'hard') return false;
  switch (c.constraint_kind) {
    case 'time': {
      // The action's effort proxies hours; if user has <2h/week hard
      // cap, exclude 'medium'/'large' actions.
      if (typeof c.value_numeric === 'number' && c.value_unit === 'hours_per_week') {
        if (c.value_numeric < 2 && action.effort !== 'small') return true;
      }
      return false;
    }
    case 'budget':
      // The catalog has no per-action $ cost yet; skip.
      return false;
    case 'injury':
    case 'medical_restriction':
      return action.needs_provider_clearance; // hard medical → require clearance
    case 'travel':
      return action.effort === 'large';
    case 'dietary_restriction':
      // Nutrition actions may conflict; we don't have fine-grained tags
      // yet, so only exclude actions that explicitly call out dietary
      // shifts.
      return /protein|fiber|deficit/i.test(action.title) && c.severity === 'hard';
    case 'equipment_access':
      return /train|lift|interval|cardio/i.test(action.title) && c.severity === 'hard';
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Selection — pick the smallest realistic recovery set
// ---------------------------------------------------------------------------

interface ScoredAction {
  action: HealthCatchUpAction;
  utility: number; // recovery_pct adjusted for effort + clearance penalty
}

function effortPenalty(effort: HealthCatchUpAction['effort']): number {
  if (effort === 'small') return 1.0;
  if (effort === 'medium') return 0.85;
  return 0.7;
}

function clearancePenalty(action: HealthCatchUpAction, cleared: boolean): number {
  if (!action.needs_provider_clearance) return 1.0;
  return cleared ? 0.95 : 0.6; // un-cleared = significantly down-weighted
}

function scoreActions(candidates: HealthCatchUpAction[], cleared: boolean): ScoredAction[] {
  return candidates
    .map((a) => ({
      action: a,
      utility: a.realistic_recovery_pct * effortPenalty(a.effort) * clearancePenalty(a, cleared),
    }))
    .sort((x, y) => y.utility - x.utility);
}

/**
 * Smallest realistic recovery: greedily pick actions until the *expected
 * recovery sum* covers the gap, capped at a sane number of items.
 */
function pickSmallestRecovery(scored: ScoredAction[], gap: number): HealthCatchUpAction[] {
  const picked: HealthCatchUpAction[] = [];
  let sum = 0;
  for (const s of scored) {
    if (sum >= gap) break;
    picked.push(s.action);
    sum += s.utility * gap; // utility is a fraction of the gap
    if (picked.length >= 4) break;
  }
  // Always include at least one entry if catalog has anything.
  if (picked.length === 0 && scored.length > 0) picked.push(scored[0].action);
  return picked;
}

// ---------------------------------------------------------------------------
// Notes — honest framing
// ---------------------------------------------------------------------------

function buildNotes(
  status: HealthStatus,
  gap: number,
  selectedNeedsClearance: boolean,
  hardConstraintCount: number,
  readiness?: number
): string[] {
  const notes: string[] = [];
  if (status === 'critically_behind') {
    notes.push(
      'You are critically behind. We are not asking you to start over. ' +
        'Below is the smallest credible recovery given what you said is possible.'
    );
  } else if (status === 'meaningfully_behind') {
    notes.push(
      'There is real distance to make up. The selected actions cover the most ' +
        'recoverable fraction of the gap with conservative effect sizes.'
    );
  } else if (status === 'slightly_behind') {
    notes.push('You are slightly behind. Small adjustments are likely enough.');
  } else if (status === 'on_track') {
    notes.push('You are on track. The actions shown sustain trajectory; none are required.');
  } else if (status === 'ahead_of_plan') {
    notes.push('You are ahead of plan. We suggest no new burdens — these are sustainers.');
  }

  if (selectedNeedsClearance) {
    notes.push(
      'At least one suggested action requires clearance from a licensed provider before starting. ' +
        'Arcana recommends; clinicians clear.'
    );
  }
  if (hardConstraintCount > 0) {
    notes.push(`Filtered to respect ${hardConstraintCount} hard constraint(s) you set.`);
  }
  if (typeof readiness === 'number' && readiness < 0.4) {
    notes.push(
      'Your readiness score is low. Consider a shorter horizon, fewer protocols at once, or ' +
        'one capability-building action first.'
    );
  }
  notes.push('Nothing here is a diagnosis or a prescription.');
  return notes;
}

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

export function computeHealthCatchUpPlan(inputs: HealthCatchUpInputs): HealthCatchUpResult {
  const status = classifyHealthStatus({
    current_score: inputs.current_score,
    target_score: inputs.target_score,
  });
  const gap = inputs.target_score - inputs.current_score;

  if (status === 'unknown') {
    return {
      status,
      gap_size: 0,
      smallest_realistic_recovery: [],
      notes: [
        'We do not yet have enough measurements to estimate where you are. ' +
          'Capture two more weeks of biometric data before catch-up planning.',
      ],
    };
  }

  // 1. Filter catalog to relevant goal_kind + domains.
  const candidates = filterCatalogByGoal(inputs.goal_kind, inputs.domains_touched).map(
    materializeAction
  );

  // 2. Filter by hard constraints.
  const hardConstraints = (inputs.constraints ?? []).filter(
    (c) => c.severity === 'hard' && c.is_active
  );
  const constraintFiltered = candidates.filter(
    (a) => !hardConstraints.some((c) => violatesConstraint(a, c))
  );

  // 3. Score + pick.
  const scored = scoreActions(constraintFiltered, inputs.has_provider_clearance ?? false);
  const picked =
    gap > 0 ? pickSmallestRecovery(scored, gap) : scored.slice(0, 1).map((s) => s.action); // ahead/on-track: 1 sustainer

  const selectedNeedsClearance = picked.some((a) => a.needs_provider_clearance);
  const notes = buildNotes(
    status,
    Math.max(0, gap),
    selectedNeedsClearance,
    hardConstraints.length,
    inputs.readiness_score
  );

  return {
    status,
    gap_size: Number(gap.toFixed(4)),
    smallest_realistic_recovery: picked,
    notes,
  };
}

export const __test = {
  classifyHealthStatus,
  computeHealthCatchUpPlan,
  violatesConstraint,
  HEALTH_CATALOG,
};
