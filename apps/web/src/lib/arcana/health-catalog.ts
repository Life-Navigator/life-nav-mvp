/**
 * Arcana Health Catalog
 *
 * Curated action library for the Arcana Health Catch-Up Engine and
 * for the Marginal Impact Ranker when it is asked to rank arcana_*
 * goals. Each entry has:
 *
 *   * realistic_recovery_pct — the fraction of a "behind" gap that the
 *     action can credibly close in the named horizon. Pegged
 *     conservatively to clinical / training-science consensus.
 *
 *   * needs_provider_clearance — when TRUE, the engine will surface a
 *     "discuss with your physician/coach first" gate. Arcana
 *     recommends; clinicians clear.
 *
 *   * citations — every action carries at least one published
 *     evidence source. The XAI layer reads these directly.
 *
 * The catalog is intentionally small and curated — not a thousand
 * micro-interventions. Each entry must be: defensible, attributable,
 * and conservative.
 *
 * Engines must NEVER suggest "start over." The catalog only contains
 * delta-improvements. Restarting from baseline is not a recovery
 * path; it is a new program.
 */

import type { ArcanaDomain, ArcanaGoalKind, HealthCatchUpAction } from '@/types/arcana';

/** Internal raw template. The engine materializes feasibility per-user. */
export interface HealthCatalogEntry {
  id: string;
  title: string;
  rationale: string;
  goal_kind: ArcanaGoalKind | 'cross';
  domains_touched: ArcanaDomain[];
  effort: 'small' | 'medium' | 'large';
  realistic_recovery_pct: number;
  horizon_months: number;
  citations: Array<{ source: string; label: string }>;
  contraindications: string[];
  needs_provider_clearance: boolean;
  // Used by ranker — accessibility heuristic.
  estimated_weekly_hours?: number;
  estimated_monthly_cost_usd?: number;
}

export const HEALTH_CATALOG: HealthCatalogEntry[] = [
  // ── Recovery / sleep ────────────────────────────────────────────────
  {
    id: 'arc.sleep.consistency.win',
    title: 'Stabilize wake time within a 60-minute window, 7 days/week',
    rationale:
      'A consistent wake time is the single highest-leverage circadian intervention; outperforms total-sleep targeting in adherence trials.',
    goal_kind: 'sleep',
    domains_touched: ['recovery', 'longevity'],
    effort: 'small',
    realistic_recovery_pct: 0.25,
    horizon_months: 2,
    citations: [
      {
        source: 'AASM 2021 Practice Guideline on Insomnia',
        label: 'wake-time stabilization recommendation',
      },
    ],
    contraindications: ['shift worker without schedule autonomy'],
    needs_provider_clearance: false,
    estimated_weekly_hours: 0,
  },
  {
    id: 'arc.sleep.duration.add60',
    title: 'Add 60 minutes of sleep opportunity, 5 nights/week',
    rationale:
      'For chronically short sleepers (<6.5h), an extra hour of opportunity recovers ~30% of measurable HRV deficit within 8 weeks.',
    goal_kind: 'sleep',
    domains_touched: ['recovery'],
    effort: 'small',
    realistic_recovery_pct: 0.3,
    horizon_months: 2,
    citations: [{ source: 'NHLBI Sleep Deprivation guidance', label: 'sleep extension benefit' }],
    contraindications: [],
    needs_provider_clearance: false,
  },

  // ── Cardio / VO2 ────────────────────────────────────────────────────
  {
    id: 'arc.cardio.zone2.add2',
    title: 'Add 2 weekly Zone 2 sessions (45 min each)',
    rationale:
      'Zone 2 is the highest-leverage stimulus for mitochondrial density / VO2max gains in the un-detrained adult; conservative dose with low injury risk.',
    goal_kind: 'cardiovascular_health',
    domains_touched: ['health', 'performance', 'longevity'],
    effort: 'medium',
    realistic_recovery_pct: 0.22,
    horizon_months: 3,
    citations: [
      {
        source: 'ACSM Guidelines for Exercise Testing and Prescription (11th ed.)',
        label: 'aerobic base recommendations',
      },
      {
        source: 'AHA 2019 Cardiovascular Prevention Guideline',
        label: '150 min/week moderate activity',
      },
    ],
    contraindications: ['uncontrolled hypertension', 'unstable angina'],
    needs_provider_clearance: true,
    estimated_weekly_hours: 1.5,
  },
  {
    id: 'arc.cardio.vo2.intervals',
    title: 'Add 1 weekly VO2 interval session (4x4 norwegian)',
    rationale:
      '4x4 intervals are the most-cited high-leverage VO2max protocol; ~5-8% improvement over 8-12 weeks in untrained adults.',
    goal_kind: 'athletic_performance',
    domains_touched: ['performance', 'longevity'],
    effort: 'medium',
    realistic_recovery_pct: 0.2,
    horizon_months: 3,
    citations: [{ source: 'ACSM Guidelines (11th ed.)', label: 'HIIT prescription' }],
    contraindications: ['arrhythmia', 'recent cardiac event', 'unmanaged hypertension'],
    needs_provider_clearance: true,
    estimated_weekly_hours: 1,
  },

  // ── Strength / body composition ─────────────────────────────────────
  {
    id: 'arc.strength.threexweek',
    title: 'Train compound lifts 3x/week (full body)',
    rationale:
      'Three full-body sessions/week is the dose-response sweet spot for hypertrophy and bone density in adults; matches lower training-frequency programs on outcomes.',
    goal_kind: 'muscle_gain',
    domains_touched: ['performance', 'body_composition', 'longevity'],
    effort: 'medium',
    realistic_recovery_pct: 0.28,
    horizon_months: 4,
    citations: [
      { source: 'ACSM Guidelines (11th ed.)', label: 'resistance training dose-response' },
    ],
    contraindications: ['acute musculoskeletal injury'],
    needs_provider_clearance: false,
    estimated_weekly_hours: 3,
  },
  {
    id: 'arc.nutrition.protein.adherence',
    title: 'Hit 1.6 g/kg protein on 5 days/week (vs current ~1.0)',
    rationale:
      'Closing a 0.6 g/kg protein gap in older adults preserves lean mass and recovers ~25% of strength-progression slope.',
    goal_kind: 'muscle_gain',
    domains_touched: ['body_composition', 'health'],
    effort: 'small',
    realistic_recovery_pct: 0.2,
    horizon_months: 3,
    citations: [
      { source: 'PROT-AGE Study Group consensus', label: 'protein 1.0-1.5 g/kg older adults' },
    ],
    contraindications: ['advanced CKD without nephrology guidance'],
    needs_provider_clearance: false,
  },
  {
    id: 'arc.body_comp.modest.deficit',
    title: 'Sustain a 300-kcal/day deficit for 12 weeks',
    rationale:
      'A modest deficit retains lean mass + adheres better than aggressive cuts; ~1 lb/week is the upper realistic ceiling without metabolic adaptation.',
    goal_kind: 'fat_loss',
    domains_touched: ['body_composition', 'health'],
    effort: 'medium',
    realistic_recovery_pct: 0.3,
    horizon_months: 3,
    citations: [{ source: 'NIH ODP Obesity Treatment guidance', label: '0.5-1 lb/week realistic' }],
    contraindications: ['history of eating disorder', 'pregnancy'],
    needs_provider_clearance: false,
  },

  // ── Metabolic / labs ────────────────────────────────────────────────
  {
    id: 'arc.metabolic.fiber.up',
    title: 'Add 10 g/day of dietary fiber for 12 weeks',
    rationale:
      'Fiber consistently shifts ApoB, glycemic variability, and A1c by clinically meaningful margins in adherence trials.',
    goal_kind: 'lab_optimization',
    domains_touched: ['health', 'longevity', 'preventative_care'],
    effort: 'small',
    realistic_recovery_pct: 0.15,
    horizon_months: 3,
    citations: [{ source: 'AHA Dietary Guidance 2021', label: 'fiber + cardiovascular risk' }],
    contraindications: ['active IBD flare', 'severe IBS-D'],
    needs_provider_clearance: false,
  },
  {
    id: 'arc.metabolic.zone2.glycemic',
    title: 'Walk 10-15 min after the largest meal, 5+ days/week',
    rationale:
      'Post-prandial movement attenuates glycemic spikes; documented small reductions in A1c trajectory.',
    goal_kind: 'lab_optimization',
    domains_touched: ['health', 'longevity'],
    effort: 'small',
    realistic_recovery_pct: 0.1,
    horizon_months: 3,
    citations: [{ source: 'ADA Standards of Care 2024', label: 'post-meal activity guidance' }],
    contraindications: [],
    needs_provider_clearance: false,
  },

  // ── Hormone-adjacent (always provider-gated) ────────────────────────
  {
    id: 'arc.hormone.lifestyle.first',
    title: 'Optimize sleep + resistance training + body comp BEFORE any hormonal protocol',
    rationale:
      'Lifestyle inputs recover roughly half of age-related total-T decline in symptomatic men before any exogenous protocol is warranted.',
    goal_kind: 'hormone_optimization',
    domains_touched: ['health', 'longevity', 'preventative_care'],
    effort: 'medium',
    realistic_recovery_pct: 0.18,
    horizon_months: 4,
    citations: [
      {
        source: 'Endocrine Society 2018 Testosterone Guideline',
        label: 'lifestyle-first recommendation',
      },
    ],
    contraindications: [],
    needs_provider_clearance: true,
  },

  // ── Preventative ────────────────────────────────────────────────────
  {
    id: 'arc.prev.screenings.current',
    title: 'Complete one missed age-appropriate screening this quarter',
    rationale:
      'Screening adherence drift creates downstream risk; closing the most-overdue item is a high-leverage 1-action win.',
    goal_kind: 'compliance',
    domains_touched: ['preventative_care'],
    effort: 'small',
    realistic_recovery_pct: 0.2,
    horizon_months: 3,
    citations: [{ source: 'USPSTF Recommendations', label: 'age-appropriate screening' }],
    contraindications: [],
    needs_provider_clearance: false,
  },

  // ── Cross-domain (energy → productivity → income) ───────────────────
  {
    id: 'arc.cross.energy.training_pairing',
    title: "Pair morning training with the day's deepest work block",
    rationale:
      'Pairing exercise with cognitive deep work compounds: ~10% measured productivity uplift on training days in self-report and intervention studies.',
    goal_kind: 'cross',
    domains_touched: ['performance', 'health'],
    effort: 'small',
    realistic_recovery_pct: 0.12,
    horizon_months: 2,
    citations: [
      {
        source: 'Exercise + cognitive performance meta-analyses (review)',
        label: 'acute cognitive uplift post-exercise',
      },
    ],
    contraindications: [],
    needs_provider_clearance: false,
  },
];

// ---------------------------------------------------------------------------
// Filtering by goal kind + domain
// ---------------------------------------------------------------------------

export function filterCatalogByGoal(
  goal_kind: ArcanaGoalKind,
  domains_touched: ArcanaDomain[]
): HealthCatalogEntry[] {
  const goalSet = new Set([goal_kind, 'cross' as const]);
  const domSet = new Set(domains_touched);
  return HEALTH_CATALOG.filter((e) => {
    if (!goalSet.has(e.goal_kind)) return false;
    return e.domains_touched.some((d) => domSet.has(d));
  });
}

// ---------------------------------------------------------------------------
// Materialize as HealthCatchUpAction
// ---------------------------------------------------------------------------

export function materializeAction(entry: HealthCatalogEntry): HealthCatchUpAction {
  return {
    id: entry.id,
    title: entry.title,
    rationale: entry.rationale,
    goal_kind: entry.goal_kind,
    domains_touched: entry.domains_touched,
    effort: entry.effort,
    realistic_recovery_pct: entry.realistic_recovery_pct,
    horizon_months: entry.horizon_months,
    citations: entry.citations,
    contraindications: entry.contraindications,
    needs_provider_clearance: entry.needs_provider_clearance,
  };
}

export const __test = { HEALTH_CATALOG, filterCatalogByGoal, materializeAction };
