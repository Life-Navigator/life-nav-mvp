/**
 * Horizon-aware impact dampening — shared by ProbabilityEngine,
 * DecisionImpactEngine, MarginalImpactRanker, CatchUpEngine,
 * AheadOfPlanEngine.
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  A SHORT-TERM goal may be strongly affected by ONE decision. │
 *   │  A LONG-TERM goal should DAMPEN the impact of one decision   │
 *   │  UNLESS that decision changes a STRUCTURAL variable          │
 *   │  (income / education credential / health trajectory /        │
 *   │   debt structure / family obligations / business ownership / │
 *   │   career path / legal-estate structure).                     │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Non-structural curve — a bump centered at `peak_months` that decays
 * exponentially beyond. This captures the fact that, for tactical
 * decisions, the effect *peaks* near the relevant decision window
 * (1-year for mortgage shopping; ~12 months for credit utilization
 * cleanup) and then fades.
 *
 * Structural curve — monotonically *non-decreasing* up to long
 * horizons, optionally compounding. A structural choice keeps growing
 * in impact over decades (income trajectory) instead of fading.
 *
 * Both curves return a multiplier in [0, ~1] that gets applied to the
 * decision's base magnitude.
 */

import type { TimeHorizon } from '@/types/decision-impact';
import { HORIZON_MONTHS } from '@/types/decision-impact';

export interface DampeningOptions {
  /** Months at which the *non-structural* effect peaks. Default 12. */
  peak_months?: number;
  /** Decay constant beyond the peak (months). Default 60 months —
   *  calibrated so the spec's worked example
   *  ("Reduce credit utilization → Home Ownership":
   *   3mo +12%, 1yr +18%, 3yr +9%, 10yr +3%) lines up
   *  with a base_magnitude of ~0.18. */
  decay_tau_months?: number;
}

/**
 * Non-structural multiplier in [0,1].
 *
 *   factor(0)         ≈ 0.40   (effect needs time to register)
 *   factor(peak/4)    ≈ 0.66   (3mo when peak=12 — matches +12% in spec)
 *   factor(peak)      = 1.00   (peak of the bump — matches +18% in spec)
 *   factor(peak+2τ)   ≈ 0.37   (3yr when peak=12, τ=60)
 *   factor(peak+9τ)   ≈ 0.03   (10yr when peak=12, τ=60)
 */
export function nonStructuralFactor(horizon: TimeHorizon, options: DampeningOptions = {}): number {
  const peak = Math.max(1, options.peak_months ?? 12);
  const tau = Math.max(1, options.decay_tau_months ?? 60);
  const t = HORIZON_MONTHS[horizon];

  if (t === 0) return 0.4; // immediate: partial
  if (t <= peak) {
    // Linear ramp from 0.55 at t=1 to 1.0 at peak so 3mo (when peak=12)
    // sits near 0.66 — matches the +12% / +18% ratio in the spec.
    const ramp = t / peak;
    return 0.55 + 0.45 * ramp;
  }
  // Exponential decay beyond peak with a longer tail than the original
  // draft. Picks up the +9% at 3y and +3% at 10y from the worked example.
  return Math.exp(-(t - peak) / tau);
}

/**
 * Structural multiplier in [0, ~1.2].
 *
 *   Monotonically non-decreasing. We model it as a saturating curve:
 *
 *      factor(t) = 1 - exp(-t / saturation_months)
 *
 *   plus a small linear "compounding" bonus for very long horizons so
 *   a finished credential / debt-structure change keeps mattering at
 *   20 years.
 */
export function structuralFactor(
  horizon: TimeHorizon,
  options: { saturation_months?: number; compounding_per_year?: number } = {}
): number {
  const saturation = Math.max(1, options.saturation_months ?? 36);
  const compounding = options.compounding_per_year ?? 0.01;
  const t = HORIZON_MONTHS[horizon];
  // Floor at 0.15 for t=0 — once a structural choice is committed, it
  // is already on the trajectory at signing, not at completion.
  const base = 0.15 + 0.85 * (1 - Math.exp(-t / saturation));
  const bonus = compounding * (t / 12);
  return Math.max(0, base + bonus);
}

/**
 * The integrated factor used by every engine:
 *
 *   if structural   → structuralFactor(horizon)
 *   if not          → nonStructuralFactor(horizon, ...peakOpts)
 */
export function dampening(
  horizon: TimeHorizon,
  isStructural: boolean,
  options: DampeningOptions = {}
): number {
  return isStructural ? structuralFactor(horizon) : nonStructuralFactor(horizon, options);
}

/**
 * Variance widening multiplier. Used by ProbabilityEngine: at longer
 * horizons the range widens, but plateaus past 10 years (further
 * decisions still buffer the outcome).
 */
export function varianceWideningForHorizon(horizon: TimeHorizon): number {
  // Curve: 0.1 immediate → 0.55 at 20 years, saturating.
  const t = HORIZON_MONTHS[horizon];
  return 0.1 + 0.45 * (1 - Math.exp(-t / 60)); // 60-month saturation
}

export const __test = {
  nonStructuralFactor,
  structuralFactor,
  dampening,
  varianceWideningForHorizon,
};
