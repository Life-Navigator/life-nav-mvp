/**
 * @jest-environment node
 */

import { selectModel, FEATURE_TIER } from '../model-selection';

describe('selectModel — tier defaults', () => {
  test('extraction.classification → Gemini Flash (tier 1)', () => {
    const r = selectModel({ feature: 'extraction.classification' });
    expect(r.tier).toBe('tier_1');
    expect(r.provider).toBe('gemini');
    expect(r.model).toBe('gemini-2.5-flash');
    expect(r.requires_operator_approval).toBe(false);
  });

  test('extraction.vision_ocr → tier 1', () => {
    const r = selectModel({ feature: 'extraction.vision_ocr' });
    expect(r.tier).toBe('tier_1');
  });

  test('tagging → tier 1', () => {
    const r = selectModel({ feature: 'tagging' });
    expect(r.tier).toBe('tier_1');
  });

  test('extraction.speech_transcript → tier 1', () => {
    expect(selectModel({ feature: 'extraction.speech_transcript' }).tier).toBe('tier_1');
  });

  test('recommendation.optimizer → Gemini Pro (tier 2)', () => {
    const r = selectModel({ feature: 'recommendation.optimizer' });
    expect(r.tier).toBe('tier_2');
    expect(r.model).toBe('gemini-2.5-pro');
  });

  test('decision_intelligence → tier 2', () => {
    expect(selectModel({ feature: 'decision_intelligence' }).tier).toBe('tier_2');
  });

  test('chat.user → tier 2', () => {
    expect(selectModel({ feature: 'chat.user' }).tier).toBe('tier_2');
  });

  test('governance.constitutional_review → tier 1 (cheap by design)', () => {
    expect(selectModel({ feature: 'governance.constitutional_review' }).tier).toBe('tier_1');
  });

  test('extraction.video → tier 3 + requires approval', () => {
    const r = selectModel({ feature: 'extraction.video' });
    expect(r.tier).toBe('tier_3');
    expect(r.requires_operator_approval).toBe(true);
  });
});

describe('selectModel — tenant overrides', () => {
  test('override forces a specific (provider, model)', () => {
    const r = selectModel({
      feature: 'chat.user',
      tenant_override: { provider: 'anthropic', model: 'claude-3-5-haiku' },
    });
    expect(r.provider).toBe('anthropic');
    expect(r.model).toBe('claude-3-5-haiku');
  });

  test('override does not change tier classification', () => {
    const r = selectModel({
      feature: 'extraction.classification',
      tenant_override: { provider: 'openai', model: 'gpt-4o-mini' },
    });
    expect(r.tier).toBe('tier_1');
    expect(r.provider).toBe('openai');
  });
});

describe('selectModel — tier 3 approval', () => {
  test('extraction.video without approval keeps requires_operator_approval=true', () => {
    expect(selectModel({ feature: 'extraction.video' }).requires_operator_approval).toBe(true);
  });

  test('extraction.video with approval clears the flag', () => {
    const r = selectModel({
      feature: 'extraction.video',
      operator_approved_features: new Set(['extraction.video']),
    });
    expect(r.requires_operator_approval).toBe(false);
  });
});

describe('FEATURE_TIER coverage', () => {
  test('every declared FeatureKey maps to a tier', () => {
    for (const [feature, tier] of Object.entries(FEATURE_TIER)) {
      expect(['tier_1', 'tier_2', 'tier_3']).toContain(tier);
      expect(feature.length).toBeGreaterThan(0);
    }
  });
});
