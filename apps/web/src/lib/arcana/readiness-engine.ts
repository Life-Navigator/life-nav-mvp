/**
 * Arcana Readiness Engine (Phase 2 closer)
 *
 * Computes the four readiness sub-scores and aggregates them into a
 * single readiness number in [0,1]:
 *
 *   * motivation   — driver scores + self-reported intensity + Why depth
 *   * capability   — declared proficiency across capability_kind buckets
 *   * capacity     — time/budget/health headroom AFTER hard constraints
 *   * consistency  — proxied by historical adherence signals if present;
 *                    falls back to a conservative midpoint when absent.
 *
 * Recommended membership tier is derived from the overall score +
 * dominant driver:
 *
 *   < 0.40                   → arcana_core (start simple)
 *   0.40 ≤ x < 0.70          → arcana_performance
 *   ≥ 0.70 AND image driver  → arcana_concierge candidate
 *   ≥ 0.70 otherwise         → arcana_performance + concierge upsell note
 *
 * Pure: same input → same output.
 */

import type {
  ArcanaCapability,
  ArcanaConstraint,
  ArcanaMotivation,
  ArcanaProfile,
  ArcanaReadiness,
  MembershipTier,
  ReadinessFactor,
} from '@/types/arcana';

export interface ReadinessInputs {
  profile: ArcanaProfile;
  capabilities?: ArcanaCapability[];
  constraints?: ArcanaConstraint[];
  motivations?: ArcanaMotivation[];

  /** Historical adherence rate in [0,1] from goal_progress observations. Optional. */
  historical_adherence?: number;
  /** Weekly hours available on top of declared commitments (computed by caller). */
  free_weekly_hours?: number;
  /** Monthly surplus after fixed costs. Optional. */
  available_surplus_usd?: number;
  /** Frozen for determinism in tests. */
  now?: string;
}

const PROFICIENCY_WEIGHT: Record<ArcanaCapability['proficiency'], number> = {
  novice: 0.25,
  intermediate: 0.55,
  advanced: 0.8,
  expert: 1.0,
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function motivationScore(
  profile: ArcanaProfile,
  motivations?: ArcanaMotivation[]
): { score: number; factors: ReadinessFactor[] } {
  const ds = [
    profile.financial_security_score ?? 0,
    profile.image_score ?? 0,
    profile.performance_score ?? 0,
  ];
  const maxDriver = Math.max(...ds);

  // Self-reported intensity boosts up to +0.2.
  const intensities = (motivations ?? []).map((m) => m.intensity ?? 0).filter((v) => v > 0);
  const avgIntensity =
    intensities.length > 0 ? intensities.reduce((a, b) => a + b, 0) / intensities.length : 0;
  const intensityBoost = Math.min(0.2, (avgIntensity / 10) * 0.2);

  // Depth surfaced (Why drill-down went deep) boosts up to +0.1.
  const depths = (motivations ?? []).map((m) => m.surfaced_at_depth ?? 0);
  const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
  const depthBoost = Math.min(0.1, (maxDepth / 4) * 0.1);

  const score = clamp01(maxDriver * 0.7 + intensityBoost + depthBoost);
  const factors: ReadinessFactor[] = [
    { dimension: 'motivation', contribution: maxDriver * 0.7, reason: 'dominant driver score' },
  ];
  if (intensityBoost > 0)
    factors.push({
      dimension: 'motivation',
      contribution: intensityBoost,
      reason: 'self-reported intensity',
    });
  if (depthBoost > 0)
    factors.push({
      dimension: 'motivation',
      contribution: depthBoost,
      reason: 'why drill-down depth',
    });
  return { score, factors };
}

function capabilityScore(capabilities?: ArcanaCapability[]): {
  score: number;
  factors: ReadinessFactor[];
} {
  if (!capabilities?.length) {
    return {
      score: 0.4, // conservative default when unknown
      factors: [
        {
          dimension: 'capability',
          contribution: 0.4,
          reason: 'default — no capability data captured yet',
        },
      ],
    };
  }
  const avg =
    capabilities.reduce((s, c) => s + PROFICIENCY_WEIGHT[c.proficiency], 0) / capabilities.length;
  return {
    score: clamp01(avg),
    factors: [
      {
        dimension: 'capability',
        contribution: avg,
        reason: `${capabilities.length} self-reported capabilities averaged`,
      },
    ],
  };
}

function capacityScore(
  free_weekly_hours?: number,
  available_surplus_usd?: number,
  constraints?: ArcanaConstraint[]
): { score: number; factors: ReadinessFactor[] } {
  let cap = 0.5;
  const factors: ReadinessFactor[] = [];

  if (typeof free_weekly_hours === 'number') {
    const h = Math.min(20, Math.max(0, free_weekly_hours));
    const c = h / 20;
    cap = cap * 0.4 + c * 0.6;
    factors.push({
      dimension: 'capacity',
      contribution: c * 0.6,
      reason: `${h} free weekly hours`,
    });
  }
  if (typeof available_surplus_usd === 'number') {
    const u = Math.min(1500, Math.max(0, available_surplus_usd)) / 1500;
    // Surplus is a small modifier — never dominates capacity.
    cap = cap * 0.85 + u * 0.15;
    factors.push({
      dimension: 'capacity',
      contribution: u * 0.15,
      reason: 'monthly surplus headroom',
    });
  }
  const hardCount = (constraints ?? []).filter((c) => c.severity === 'hard' && c.is_active).length;
  const penalty = Math.min(0.4, hardCount * 0.1);
  cap = clamp01(cap - penalty);
  if (penalty > 0)
    factors.push({
      dimension: 'capacity',
      contribution: -penalty,
      reason: `${hardCount} hard constraint(s)`,
    });
  return { score: cap, factors };
}

function consistencyScore(historical_adherence?: number): {
  score: number;
  factors: ReadinessFactor[];
} {
  if (typeof historical_adherence === 'number') {
    const s = clamp01(historical_adherence);
    return {
      score: s,
      factors: [{ dimension: 'consistency', contribution: s, reason: 'historical adherence' }],
    };
  }
  return {
    score: 0.5,
    factors: [
      { dimension: 'consistency', contribution: 0.5, reason: 'default — no adherence history yet' },
    ],
  };
}

function recommendTier(overall: number, dominant?: string | null): MembershipTier {
  if (overall < 0.4) return 'arcana_core';
  if (overall >= 0.7 && dominant === 'image') return 'arcana_concierge';
  return 'arcana_performance';
}

function buildRisks(
  inputs: ReadinessInputs,
  m: number,
  c: number,
  cap: number,
  cons: number
): Array<{ risk: string; severity: 'low' | 'medium' | 'high'; mitigation?: string }> {
  const risks: Array<{ risk: string; severity: 'low' | 'medium' | 'high'; mitigation?: string }> =
    [];
  if (m < 0.4)
    risks.push({
      risk: 'low motivation signal — adherence likely to drop after 4-6 weeks',
      severity: 'high',
      mitigation: 'shorter horizons + Need-Behind-Need re-surface',
    });
  if (c < 0.35)
    risks.push({
      risk: 'limited training/diet experience — overprescription likely to fail',
      severity: 'medium',
      mitigation: 'capability-building action first',
    });
  if (cap < 0.35)
    risks.push({
      risk: 'limited capacity given constraints',
      severity: 'medium',
      mitigation: 'pick 1 small action, not 3',
    });
  if (cons < 0.4)
    risks.push({
      risk: 'adherence history weak or unknown',
      severity: 'medium',
      mitigation: 'use behavior streak tracker before adding protocols',
    });
  const hardCount = (inputs.constraints ?? []).filter(
    (cc) => cc.severity === 'hard' && cc.is_active
  ).length;
  if (hardCount >= 3)
    risks.push({
      risk: `${hardCount} hard constraints will narrow feasible recovery set`,
      severity: 'medium',
    });
  return risks;
}

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

export function computeReadiness(inputs: ReadinessInputs): ArcanaReadiness {
  const m = motivationScore(inputs.profile, inputs.motivations);
  const c = capabilityScore(inputs.capabilities);
  const cap = capacityScore(
    inputs.free_weekly_hours,
    inputs.available_surplus_usd,
    inputs.constraints
  );
  const cons = consistencyScore(inputs.historical_adherence);

  const overall = clamp01(0.3 * m.score + 0.25 * c.score + 0.25 * cap.score + 0.2 * cons.score);

  const drivers: ReadinessFactor[] = [...m.factors, ...c.factors, ...cap.factors, ...cons.factors];

  const risks = buildRisks(inputs, m.score, c.score, cap.score, cons.score);
  const tier = recommendTier(overall, inputs.profile.dominant_driver ?? null);

  const now = inputs.now ?? '1970-01-01T00:00:00.000Z';
  return {
    id: '',
    user_id: inputs.profile.user_id,
    profile_id: inputs.profile.id,
    computed_at: now,
    overall_score: Number(overall.toFixed(4)),
    motivation_score: Number(m.score.toFixed(4)),
    capability_score: Number(c.score.toFixed(4)),
    capacity_score: Number(cap.score.toFixed(4)),
    consistency_score: Number(cons.score.toFixed(4)),
    drivers,
    risks,
    recommended_membership: tier,
    metadata: {},
    created_at: now,
    updated_at: now,
  };
}

export const __test = {
  computeReadiness,
  motivationScore,
  capabilityScore,
  capacityScore,
  consistencyScore,
  recommendTier,
};
