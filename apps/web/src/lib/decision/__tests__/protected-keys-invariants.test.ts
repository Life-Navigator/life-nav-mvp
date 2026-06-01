/**
 * @jest-environment node
 *
 * Sprint guard test: the expanded RecommendationOutput surface
 * (`pathway_label`, `goal_progress_impact`, `confidence_calibrated`,
 * `supporting_evidence`, `historical_effectiveness`) must remain
 * protected from learning-layer mutation.
 *
 * This test plus the existing personal-learning-profile suite is the
 * full coverage for the no-manipulation contract on the new fields.
 */

import { applyToRecommendation } from '../personal-learning-profile';
import type { LearningProfile } from '@/types/decision-journal';
import type { RecommendationOutput } from '@/types/advisor';

function baseRec(): RecommendationOutput {
  return {
    root_goal: {
      inferred_true_goal: 'Financial Independence',
      confidence: 0.7,
      source: 'goal_interpretation',
    },
    supporting_goals: [],
    blocked_goals: [],
    required_actions: [
      {
        id: 'a1',
        title: 'Build emergency fund',
        domain: 'finance',
        rationale: 'reserve',
        expected_strength: 0.8,
        related_central_entity_ids: ['e1'],
        related_personal_goal_ids: [],
      },
    ],
    recommended_sequence: ['a1'],
    confidence_score: 0.65,
    tradeoffs: [],
    timeline: [{ horizon: 'now', action_ids: ['a1'] }],
    risks: [],
    assumptions: [],
    cross_domain_impacts: [],
    pathway_label: 'Income Growth First',
    goal_progress_impact: { score_before: 0.3, score_after: 0.42, delta: 0.12, confidence: 0.7 },
    confidence_calibrated: 0.55,
    supporting_evidence: [
      { kind: 'central_ontology', label: 'CFA Charter', central_entity_id: 'e1', confidence: 0.9 },
    ],
    historical_effectiveness: {
      pathway_label: 'Income Growth First',
      sample_size: 42,
      success_rate: 0.71,
      scope: 'cohort',
    },
  };
}

describe('PROTECTED_KEYS expansion (new transparency fields)', () => {
  test('pathway_label survives apply()', () => {
    const profile: LearningProfile = { user_id: 'u', signals: [], follow_through_rate: 0.7 };
    const r = baseRec();
    const { output } = applyToRecommendation(profile, r);
    expect(output.pathway_label).toBe(r.pathway_label);
  });

  test('goal_progress_impact survives apply()', () => {
    const profile: LearningProfile = { user_id: 'u', signals: [], follow_through_rate: 0.7 };
    const r = baseRec();
    const { output } = applyToRecommendation(profile, r);
    expect(output.goal_progress_impact).toEqual(r.goal_progress_impact);
  });

  test('confidence_calibrated survives apply()', () => {
    const profile: LearningProfile = { user_id: 'u', signals: [], follow_through_rate: 0.7 };
    const r = baseRec();
    const { output } = applyToRecommendation(profile, r);
    expect(output.confidence_calibrated).toBe(r.confidence_calibrated);
  });

  test('supporting_evidence survives apply()', () => {
    const profile: LearningProfile = { user_id: 'u', signals: [], follow_through_rate: 0.7 };
    const r = baseRec();
    const { output } = applyToRecommendation(profile, r);
    expect(output.supporting_evidence).toEqual(r.supporting_evidence);
  });

  test('historical_effectiveness survives apply()', () => {
    const profile: LearningProfile = { user_id: 'u', signals: [], follow_through_rate: 0.7 };
    const r = baseRec();
    const { output } = applyToRecommendation(profile, r);
    expect(output.historical_effectiveness).toEqual(r.historical_effectiveness);
  });

  test('all five new fields are byte-identical after the most aggressive learning profile', () => {
    const profile: LearningProfile = {
      user_id: 'u',
      signals: [],
      follow_through_rate: 0.3,
      preferred_style: 'brief',
      procrastination_median_days: 90,
      accept_rate: 0.1,
      outcome_mean_accuracy: 0.2,
    };
    const r = baseRec();
    const { output } = applyToRecommendation(profile, r);
    const protectedFields = [
      'pathway_label',
      'goal_progress_impact',
      'confidence_calibrated',
      'supporting_evidence',
      'historical_effectiveness',
    ] as const;
    for (const f of protectedFields) {
      expect(JSON.stringify(output[f])).toBe(JSON.stringify(r[f]));
    }
  });
});
