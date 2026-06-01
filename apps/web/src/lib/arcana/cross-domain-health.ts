/**
 * Cross-Domain Health (Phase 11)
 *
 * Health is upstream of EVERYTHING. This module makes that explicit
 * with a curated, citation-backed graph of effect chains. The map is
 * intentionally small — high-confidence linkages only.
 *
 * Direction is always: health input → mediator → downstream domain.
 *
 * Effect magnitudes are LABELED (weak/moderate/strong) — we
 * deliberately do NOT publish numeric effect sizes here because the
 * underlying literature is heterogeneous.
 *
 * Pure, deterministic. Same query → same answer.
 */

import type {
  ArcanaGoalKind,
  BiometricKind,
  CrossDomainHealthEffect,
  CrossDomainHealthLink,
  LabKind,
} from '@/types/arcana';

// ---------------------------------------------------------------------------
// The graph: ~25 high-confidence linkages
// ---------------------------------------------------------------------------

export const CROSS_DOMAIN_LINKS: CrossDomainHealthLink[] = [
  // Sleep → Cognition → Career income (the canonical chain)
  {
    source_metric: 'sleep_duration_min',
    affects: 'cognition',
    downstream_domain: 'career',
    effect_direction: 'positive',
    effect_magnitude_label: 'strong',
    citation: {
      source: 'NHLBI Sleep Deprivation guidance',
      label: 'cognition impairment from short sleep',
    },
  },
  {
    source_metric: 'sleep_efficiency_pct',
    affects: 'cognition',
    downstream_domain: 'career',
    effect_direction: 'positive',
    effect_magnitude_label: 'moderate',
    citation: {
      source: 'AASM 2021 Insomnia Guideline',
      label: 'sleep efficiency + daytime function',
    },
  },

  // VO2max → Productivity, Longevity
  {
    source_metric: 'vo2_max',
    affects: 'energy',
    downstream_domain: 'career',
    effect_direction: 'positive',
    effect_magnitude_label: 'moderate',
    citation: {
      source: 'ACSM Guidelines (11th ed.)',
      label: 'cardiorespiratory fitness + workday capacity',
    },
  },
  {
    source_metric: 'vo2_max',
    affects: 'longevity_quality',
    downstream_domain: 'longevity',
    effect_direction: 'positive',
    effect_magnitude_label: 'strong',
    citation: {
      source: 'AHA Scientific Statement on Cardiorespiratory Fitness',
      label: 'CRF + all-cause mortality',
    },
  },

  // HRV → Stress recovery → Productivity
  {
    source_metric: 'hrv',
    affects: 'mood',
    downstream_domain: 'family',
    effect_direction: 'positive',
    effect_magnitude_label: 'moderate',
    citation: {
      source: 'Frontiers in Public Health (HRV review)',
      label: 'HRV + affect regulation',
    },
  },
  {
    source_metric: 'hrv',
    affects: 'cognition',
    downstream_domain: 'career',
    effect_direction: 'positive',
    effect_magnitude_label: 'weak',
    citation: {
      source: 'Frontiers in Public Health (HRV review)',
      label: 'HRV + executive function',
    },
  },

  // Resting HR → Cardiovascular risk → Longevity
  {
    source_metric: 'resting_heart_rate',
    affects: 'cardiovascular_health',
    downstream_domain: 'longevity',
    effect_direction: 'negative', // high RHR → worse longevity
    effect_magnitude_label: 'moderate',
    citation: {
      source: 'AHA Resting Heart Rate Scientific Statement',
      label: 'RHR + cardiovascular mortality',
    },
  },

  // Resting BP → Cardiovascular events → Longevity
  {
    source_metric: 'resting_blood_pressure_systolic',
    affects: 'cardiovascular_health',
    downstream_domain: 'longevity',
    effect_direction: 'negative',
    effect_magnitude_label: 'strong',
    citation: {
      source: 'AHA/ACC Hypertension Guideline 2017',
      label: 'systolic BP + cardiovascular risk',
    },
  },

  // Body composition → Metabolic health → Longevity
  {
    source_metric: 'waist_circumference',
    affects: 'metabolic_health',
    downstream_domain: 'longevity',
    effect_direction: 'negative',
    effect_magnitude_label: 'strong',
    citation: {
      source: 'IDF Worldwide Consensus on Metabolic Syndrome',
      label: 'central adiposity + MetS',
    },
  },
  {
    source_metric: 'body_fat_pct',
    affects: 'metabolic_health',
    downstream_domain: 'longevity',
    effect_direction: 'negative',
    effect_magnitude_label: 'moderate',
    citation: {
      source: 'NIH ODP Obesity Treatment guidance',
      label: 'adiposity + metabolic outcomes',
    },
  },

  // Lean mass → All-cause mortality
  {
    source_metric: 'lean_mass',
    affects: 'longevity_quality',
    downstream_domain: 'longevity',
    effect_direction: 'positive',
    effect_magnitude_label: 'moderate',
    citation: {
      source: 'PROT-AGE Study Group consensus',
      label: 'muscle mass + outcomes in aging',
    },
  },

  // Labs → downstream
  {
    source_metric: 'a1c',
    affects: 'metabolic_health',
    downstream_domain: 'longevity',
    effect_direction: 'negative',
    effect_magnitude_label: 'strong',
    citation: { source: 'ADA Standards of Care 2024', label: 'glycemia + complications' },
  },
  {
    source_metric: 'apo_b',
    affects: 'cardiovascular_health',
    downstream_domain: 'longevity',
    effect_direction: 'negative',
    effect_magnitude_label: 'strong',
    citation: {
      source: 'European Atherosclerosis Society Consensus 2023',
      label: 'ApoB as primary risk marker',
    },
  },
  {
    source_metric: 'lp_a',
    affects: 'cardiovascular_health',
    downstream_domain: 'longevity',
    effect_direction: 'negative',
    effect_magnitude_label: 'moderate',
    citation: {
      source: 'European Atherosclerosis Society Lp(a) Statement',
      label: 'Lp(a) + cardiovascular risk',
    },
  },
  {
    source_metric: 'vitamin_d_25oh',
    affects: 'energy',
    downstream_domain: 'career',
    effect_direction: 'positive',
    effect_magnitude_label: 'weak',
    citation: {
      source: 'Endocrine Society Vitamin D Guideline 2024',
      label: 'vit D + fatigue heterogeneity',
    },
  },
  {
    source_metric: 'tsh',
    affects: 'energy',
    downstream_domain: 'career',
    effect_direction: 'negative',
    effect_magnitude_label: 'moderate',
    citation: { source: 'ATA Hypothyroidism Guidelines', label: 'TSH + fatigue / metabolism' },
  },

  // Goals → cross-domain
  {
    source_metric: 'cardiovascular_health',
    affects: 'longevity_quality',
    downstream_domain: 'longevity',
    effect_direction: 'positive',
    effect_magnitude_label: 'strong',
    citation: {
      source: 'AHA 2019 Cardiovascular Prevention Guideline',
      label: 'CV health + life expectancy',
    },
  },
  {
    source_metric: 'sleep',
    affects: 'productivity',
    downstream_domain: 'career',
    effect_direction: 'positive',
    effect_magnitude_label: 'strong',
    citation: { source: 'AASM 2021 Insomnia Guideline', label: 'sleep + daytime function' },
  },
  {
    source_metric: 'energy',
    affects: 'productivity',
    downstream_domain: 'career',
    effect_direction: 'positive',
    effect_magnitude_label: 'strong',
    citation: { source: 'ACSM Guidelines (11th ed.)', label: 'fitness + work capacity' },
  },
  {
    source_metric: 'recovery',
    affects: 'mood',
    downstream_domain: 'family',
    effect_direction: 'positive',
    effect_magnitude_label: 'moderate',
    citation: {
      source: 'AASM 2021 Insomnia Guideline',
      label: 'recovery + interpersonal capacity',
    },
  },
];

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function linksFromMetric(
  metric: BiometricKind | LabKind | ArcanaGoalKind
): CrossDomainHealthLink[] {
  return CROSS_DOMAIN_LINKS.filter((l) => l.source_metric === metric);
}

export function linksAffecting(effect: CrossDomainHealthEffect): CrossDomainHealthLink[] {
  return CROSS_DOMAIN_LINKS.filter((l) => l.affects === effect);
}

export function linksToDomain(
  domain: CrossDomainHealthLink['downstream_domain']
): CrossDomainHealthLink[] {
  return CROSS_DOMAIN_LINKS.filter((l) => l.downstream_domain === domain);
}

// ---------------------------------------------------------------------------
// Effect chain narration
// ---------------------------------------------------------------------------

/**
 * Build a short narration of a health → downstream chain, e.g.
 *   "VO2max strongly improves cardiovascular health, which strongly
 *    extends longevity quality."
 *
 * Deterministic; uses a fixed format string.
 */
export function narrateLink(link: CrossDomainHealthLink): string {
  const dir = link.effect_direction === 'positive' ? 'improves' : 'worsens';
  return `${formatMetric(link.source_metric)} ${magnitudeWord(link.effect_magnitude_label)} ${dir} ${effectPhrase(link.affects)} — relevant to ${link.downstream_domain} outcomes.`;
}

function formatMetric(m: string): string {
  return m.replace(/_/g, ' ');
}

function magnitudeWord(label: 'weak' | 'moderate' | 'strong'): string {
  if (label === 'strong') return 'strongly';
  if (label === 'moderate') return 'moderately';
  return 'weakly';
}

function effectPhrase(e: CrossDomainHealthEffect): string {
  switch (e) {
    case 'energy':
      return 'energy availability';
    case 'productivity':
      return 'daily productivity';
    case 'mood':
      return 'mood and affect';
    case 'cognition':
      return 'cognitive performance';
    case 'sleep_quality':
      return 'sleep quality';
    case 'metabolic_health':
      return 'metabolic health';
    case 'cardiovascular_health':
      return 'cardiovascular health';
    case 'longevity_quality':
      return 'longevity quality';
  }
}

export const __test = {
  CROSS_DOMAIN_LINKS,
  linksFromMetric,
  linksAffecting,
  linksToDomain,
  narrateLink,
};
