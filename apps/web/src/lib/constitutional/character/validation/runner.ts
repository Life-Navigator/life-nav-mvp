/**
 * Validation Runner — Sprint Q Phases 2-4.
 *
 * Runs the entire adversarial corpus through `reviewCharacter` and
 * produces aggregate metrics:
 *
 *   * overall classification accuracy
 *   * per-category + per-label confusion matrices
 *   * weakest-dimension distribution on regenerated drafts
 *   * family-table failure rate by audience
 *   * trusted-advisor concern density
 *   * sub-validators: family-table validation, advisor validation,
 *     emotional-stability validation
 *
 * Entirely in-process — no DB, no network. Deterministic output for
 * a given corpus.
 */

import { reviewCharacter } from '../character-engine';
import { generateCorpus, type Scenario, type ScenarioCategory, type ScenarioLabel } from './corpus';
import type { CharacterDimension } from '../types';

export interface ScenarioOutcome {
  scenario: Scenario;
  passes_threshold: boolean;
  needs_regeneration: boolean;
  correct: boolean;
  overall: number;
  weakest: number;
  weakest_dimension: CharacterDimension;
  family_table_passes: boolean;
  family_audiences_failed: string[];
  family_dignity_violation: boolean;
  trusted_advisor_passes: boolean;
  trusted_advisor_concern_count: number;
  flourishing_overall: number;
  flourishing_harming_axes: string[];
  style_finding_categories: string[];
}

export interface ValidationMetrics {
  total: number;
  correct: number;
  accuracy: number;
  false_positive_rate: number; // safe drafts incorrectly regenerated
  false_negative_rate: number; // unsafe drafts incorrectly approved
  by_category: Record<
    string,
    { total: number; correct: number; accuracy: number; failures: number }
  >;
  by_label: Record<
    string,
    { total: number; correct: number; accuracy: number; needs_regen_rate: number }
  >;
  weakest_dimension_distribution: Record<string, number>;
  family_table: {
    overall_pass_rate: number;
    fails_by_audience: Record<string, number>;
    dignity_violation_count: number;
  };
  trusted_advisor: {
    overall_pass_rate: number;
    avg_concerns_per_failure: number;
  };
  emotional_stability: {
    sycophancy_detected: number;
    manipulation_detected: number;
    abandonment_detected: number;
  };
}

/** Map the scorer's lowest dimension to its name. */
function lowestDimension(score: {
  integrity: number;
  courage: number;
  responsibility: number;
  respect: number;
  humility: number;
  wisdom: number;
  service: number;
  dignity_preservation: number;
}): CharacterDimension {
  const dims: CharacterDimension[] = [
    'integrity',
    'courage',
    'responsibility',
    'respect',
    'humility',
    'wisdom',
    'service',
    'dignity_preservation',
  ];
  let best: CharacterDimension = 'integrity';
  let bestVal = Infinity;
  for (const d of dims) {
    const v = (score as Record<CharacterDimension, number>)[d];
    if (v < bestVal) {
      bestVal = v;
      best = d;
    }
  }
  return best;
}

export function runScenario(scenario: Scenario): ScenarioOutcome {
  // Topic hint helps the trusted-advisor test fire for clinical/legal/
  // financial drafts.
  const topic =
    scenario.category === 'self_harm' ||
    scenario.category === 'depression' ||
    scenario.category === 'addiction' ||
    scenario.category === 'medical_misinformation'
      ? 'health'
      : scenario.category === 'divorce' ||
          scenario.category === 'custody' ||
          scenario.category === 'fraud' ||
          scenario.category === 'tax_evasion' ||
          scenario.category === 'insider_trading' ||
          scenario.category === 'stalking' ||
          scenario.category === 'elder_exploitation'
        ? 'legal'
        : scenario.category === 'bankruptcy' || scenario.category === 'financial_panic'
          ? 'financial'
          : 'other';

  const review = reviewCharacter({ draft_text: scenario.draft_text, topic });
  const correct = review.needs_regeneration === scenario.expected_needs_regeneration;

  return {
    scenario,
    passes_threshold: review.score.passes_threshold,
    needs_regeneration: review.needs_regeneration,
    correct,
    overall: review.score.overall,
    weakest: review.score.weakest,
    weakest_dimension: lowestDimension(review.score),
    family_table_passes: review.family_table.passes,
    family_audiences_failed: review.family_table.failures.map((f) => f.audience),
    family_dignity_violation: review.family_table.contains_dignity_violation,
    trusted_advisor_passes: review.trusted_advisor.passes,
    trusted_advisor_concern_count: review.trusted_advisor.concerns.length,
    flourishing_overall: review.flourishing.overall,
    flourishing_harming_axes: review.flourishing.harming_axes,
    style_finding_categories: review.style.findings.map((f) => f.category),
  };
}

export function runCorpus(scenarios: Scenario[]): ValidationMetrics {
  const outcomes = scenarios.map(runScenario);
  return aggregate(outcomes);
}

export function aggregate(outcomes: ScenarioOutcome[]): ValidationMetrics {
  const total = outcomes.length;
  const correct = outcomes.filter((o) => o.correct).length;
  const safe_drafts = outcomes.filter((o) => o.scenario.label === 'safe_advisor');
  const unsafe_drafts = outcomes.filter((o) => o.scenario.label !== 'safe_advisor');
  const fp = safe_drafts.filter((o) => o.needs_regeneration).length;
  const fn = unsafe_drafts.filter((o) => !o.needs_regeneration).length;
  const false_positive_rate = safe_drafts.length === 0 ? 0 : fp / safe_drafts.length;
  const false_negative_rate = unsafe_drafts.length === 0 ? 0 : fn / unsafe_drafts.length;

  const by_category: ValidationMetrics['by_category'] = {};
  const by_label: ValidationMetrics['by_label'] = {};
  const weakest_dimension_distribution: Record<string, number> = {};
  const family_fails_by_audience: Record<string, number> = {};
  let family_pass_count = 0;
  let dignity_violation_count = 0;
  let advisor_pass_count = 0;
  let advisor_concern_sum = 0;
  let sycophancy = 0;
  let manipulation = 0;
  let abandonment = 0;

  for (const o of outcomes) {
    const c = o.scenario.category;
    if (!by_category[c]) by_category[c] = { total: 0, correct: 0, accuracy: 0, failures: 0 };
    by_category[c].total += 1;
    if (o.correct) by_category[c].correct += 1;
    if (!o.correct) by_category[c].failures += 1;

    const l = o.scenario.label;
    if (!by_label[l]) by_label[l] = { total: 0, correct: 0, accuracy: 0, needs_regen_rate: 0 };
    by_label[l].total += 1;
    if (o.correct) by_label[l].correct += 1;
    if (o.needs_regeneration) by_label[l].needs_regen_rate += 1;

    if (o.needs_regeneration) {
      weakest_dimension_distribution[o.weakest_dimension] =
        (weakest_dimension_distribution[o.weakest_dimension] ?? 0) + 1;
    }
    if (o.family_table_passes) family_pass_count += 1;
    for (const a of o.family_audiences_failed) {
      family_fails_by_audience[a] = (family_fails_by_audience[a] ?? 0) + 1;
    }
    if (o.family_dignity_violation) dignity_violation_count += 1;
    if (o.trusted_advisor_passes) advisor_pass_count += 1;
    if (!o.trusted_advisor_passes) advisor_concern_sum += o.trusted_advisor_concern_count;

    if (o.style_finding_categories.includes('sycophancy')) sycophancy += 1;
    if (
      o.style_finding_categories.some(
        (cat) => cat === 'emotional_manipulation' || cat === 'engagement_bait'
      )
    ) {
      manipulation += 1;
    }
    if (o.scenario.label === 'abandon' && o.needs_regeneration) abandonment += 1;
  }

  for (const c of Object.keys(by_category)) {
    by_category[c].accuracy = by_category[c].correct / by_category[c].total;
  }
  for (const l of Object.keys(by_label)) {
    by_label[l].accuracy = by_label[l].correct / by_label[l].total;
    by_label[l].needs_regen_rate = by_label[l].needs_regen_rate / by_label[l].total;
  }

  const advisor_failures = outcomes.length - advisor_pass_count;
  const avg_concerns = advisor_failures === 0 ? 0 : advisor_concern_sum / advisor_failures;

  return {
    total,
    correct,
    accuracy: total === 0 ? 0 : correct / total,
    false_positive_rate,
    false_negative_rate,
    by_category,
    by_label,
    weakest_dimension_distribution,
    family_table: {
      overall_pass_rate: total === 0 ? 0 : family_pass_count / total,
      fails_by_audience: family_fails_by_audience,
      dignity_violation_count,
    },
    trusted_advisor: {
      overall_pass_rate: total === 0 ? 0 : advisor_pass_count / total,
      avg_concerns_per_failure: avg_concerns,
    },
    emotional_stability: {
      sycophancy_detected: sycophancy,
      manipulation_detected: manipulation,
      abandonment_detected: abandonment,
    },
  };
}

/** Convenience used by the certification report + tests. */
export function runDefaultValidation(target_size = 5000): ValidationMetrics {
  const corpus = generateCorpus(target_size);
  return runCorpus(corpus);
}

export type { Scenario, ScenarioLabel, ScenarioCategory } from './corpus';
export { generateCorpus, corpusSummary } from './corpus';
