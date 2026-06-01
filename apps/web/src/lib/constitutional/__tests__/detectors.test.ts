/**
 * @jest-environment node
 *
 * Detection-engine tests — emotional intelligence, cognitive
 * distortion, crisis, future visibility.
 */

import { __test as emoTest } from '../detectors/emotional-intelligence-engine';
import { __test as cogTest } from '../detectors/cognitive-distortion-engine';
import { __test as crisisTest } from '../detectors/crisis-detection-engine';
import { __test as fvTest } from '../detectors/future-visibility-engine';

// ---------------------------------------------------------------------------
// EmotionalIntelligenceEngine
// ---------------------------------------------------------------------------

describe('EmotionalIntelligenceEngine', () => {
  test('benign text → LOW with no signals', () => {
    const r = emoTest.assessEmotionalState('I want to plan a vacation next summer.');
    expect(r.risk_level).toBe('LOW');
    expect(r.emotional_state).toEqual([]);
    expect(r.future_visibility_score).toBe(1);
  });

  test('despair + hopelessness → HIGH or CRITICAL with low future visibility', () => {
    const r = emoTest.assessEmotionalState("I see no way out. There's no future. My life is over.");
    expect(['HIGH', 'CRITICAL']).toContain(r.risk_level);
    expect(r.future_visibility_score).toBeLessThan(0.4);
  });

  test('mixed grief + anger → MODERATE or HIGH', () => {
    const r = emoTest.assessEmotionalState(
      "I'm so angry. They deserve it. I just lost everything."
    );
    expect(['MODERATE', 'HIGH', 'CRITICAL']).toContain(r.risk_level);
  });

  test('decision quality risk rises with rage + panic + obsession', () => {
    const r = emoTest.assessEmotionalState(
      "I want to scream and destroy. I can't breathe. I can't stop thinking about it."
    );
    expect(r.decision_quality_risk_score).toBeGreaterThan(0.5);
  });

  test('determinism', () => {
    const t = "I'm so angry. They deserve it.";
    expect(JSON.stringify(emoTest.assessEmotionalState(t))).toBe(
      JSON.stringify(emoTest.assessEmotionalState(t))
    );
  });
});

// ---------------------------------------------------------------------------
// CognitiveDistortionEngine
// ---------------------------------------------------------------------------

describe('CognitiveDistortionEngine', () => {
  test('catastrophizing detected', () => {
    const r = cogTest.detectDistortions('This is the worst thing imaginable. My life is over.');
    expect(r.some((d) => d.kind === 'catastrophizing')).toBe(true);
  });
  test('black-and-white thinking detected', () => {
    const r = cogTest.detectDistortions('There is only one path forward.');
    expect(r.some((d) => d.kind === 'black_and_white')).toBe(true);
  });
  test('hopelessness loop detected', () => {
    const r = cogTest.detectDistortions('Why bother. Nothing matters.');
    expect(r.some((d) => d.kind === 'hopelessness_loop')).toBe(true);
  });
  test('revenge fixation detected', () => {
    const r = cogTest.detectDistortions('Make them pay. I will get even.');
    expect(r.some((d) => d.kind === 'revenge_fixation')).toBe(true);
  });
  test('benign text → no distortions', () => {
    expect(cogTest.detectDistortions('I want to learn Spanish this year.')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// CrisisDetectionEngine
// ---------------------------------------------------------------------------

describe('CrisisDetectionEngine', () => {
  test('suicidal ideation direct → CRITICAL', () => {
    const r = crisisTest.assessCrisis('I want to end my life. I have a plan.');
    expect(r.level).toBe('CRITICAL');
    expect(r.suspend_goal_optimization).toBe(true);
    expect(r.escalation_recommended).toBe(true);
  });
  test('violence toward named other → CRITICAL', () => {
    const r = crisisTest.assessCrisis("I'm going to kill him.");
    expect(r.level).toBe('CRITICAL');
  });
  test('self-harm risk → HIGH', () => {
    const r = crisisTest.assessCrisis('I want to hurt myself.');
    expect(['HIGH', 'CRITICAL']).toContain(r.level);
  });
  test('extreme hopelessness → HIGH', () => {
    const r = crisisTest.assessCrisis('My life is over. There is no future.');
    expect(['HIGH', 'CRITICAL']).toContain(r.level);
  });
  test('casual idiom → LOW (false-positive guard)', () => {
    const r = crisisTest.assessCrisis('I could kill for a coffee right now.');
    expect(r.level).toBe('LOW');
    expect(r.suspend_goal_optimization).toBe(false);
  });
  test('determinism', () => {
    const t = 'I want to hurt myself.';
    expect(JSON.stringify(crisisTest.assessCrisis(t))).toBe(
      JSON.stringify(crisisTest.assessCrisis(t))
    );
  });
});

// ---------------------------------------------------------------------------
// FutureVisibilityEngine
// ---------------------------------------------------------------------------

describe('FutureVisibilityEngine', () => {
  test('detects future-collapse pattern', () => {
    const r = fvTest.assessFutureVisibility('My life is over.');
    expect(r.needs_expansion).toBe(true);
    expect(r.options.length).toBeGreaterThan(0);
  });
  test('options carry feasibility labels — none promise outcomes', () => {
    const r = fvTest.assessFutureVisibility('There is no future.');
    for (const o of r.options) {
      expect(['plausible', 'possible', 'uncertain']).toContain(o.feasibility_label);
      expect(o.description.toLowerCase()).not.toContain('guaranteed');
    }
  });
  test('benign text does not trigger', () => {
    const r = fvTest.assessFutureVisibility('I am thinking about going back to school.');
    expect(r.needs_expansion).toBe(false);
  });
});
