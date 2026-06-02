/**
 * @jest-environment node
 */

import { estimateCost, projectCost, microsToUsd } from '../cost-estimator';
import { MICROS_PER_USD } from '../types';

describe('CostEstimator — gemini', () => {
  test('gemini-2.5-flash text-only is sub-cent for 1k+256 tokens', () => {
    const e = estimateCost({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      units: { text_input: 1000, text_output: 256 },
    });
    expect(e.modeled).toBe(true);
    // 75 + 256/1000 * 300 = 75 + 76.8 → 152 micros
    expect(e.total_micros).toBeLessThan(200);
    expect(e.per_dimension.text_input).toBe(75);
    expect(e.per_dimension.text_output).toBe(77);
  });

  test('gemini-2.5-pro charges substantially more', () => {
    const e = estimateCost({
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      units: { text_input: 1000, text_output: 256 },
    });
    // 1250 + 256/1000 * 5000 = 1250 + 1280 = 2530 micros
    expect(e.total_micros).toBe(2530);
  });

  test('gemini-2.5-pro video is $0.10/min', () => {
    const e = estimateCost({
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      units: { video_minute: 3 },
    });
    // 3 minutes * 100_000 micros = 300_000 micros = $0.30
    expect(e.total_micros).toBe(300_000);
  });
});

describe('CostEstimator — openai', () => {
  test('gpt-4o-mini transcription via Whisper is 6000 micros/min', () => {
    const e = estimateCost({
      provider: 'openai',
      model: 'gpt-4o-mini',
      units: { speech_minute: 5 },
    });
    expect(e.total_micros).toBe(30_000); // $0.03
  });
});

describe('CostEstimator — anthropic', () => {
  test('claude-3-5-sonnet vision is 6800 micros per image', () => {
    const e = estimateCost({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      units: { vision_image: 4 },
    });
    expect(e.total_micros).toBe(27_200);
  });
});

describe('CostEstimator — unknown models use conservative ceiling', () => {
  test('unmodeled (provider, model) flips modeled:false', () => {
    const e = estimateCost({
      provider: 'gemini',
      model: 'gemini-experimental',
      units: { text_input: 1000, text_output: 256 },
    });
    expect(e.modeled).toBe(false);
    expect(e.total_micros).toBeGreaterThan(100_000); // ceiling kicked in
  });

  test('zero-unit dims contribute zero', () => {
    const e = estimateCost({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      units: { text_input: 0, vision_image: 0 },
    });
    expect(e.total_micros).toBe(0);
  });
});

describe('projectCost', () => {
  test('sums multiple estimates', () => {
    const a = estimateCost({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      units: { text_input: 1000 },
    });
    const b = estimateCost({
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      units: { text_input: 1000 },
    });
    expect(projectCost([a, b])).toBe(a.total_micros + b.total_micros);
  });
});

describe('microsToUsd', () => {
  test('converts integer micros to floating-point USD', () => {
    expect(microsToUsd(MICROS_PER_USD)).toBe(1.0);
    expect(microsToUsd(150_000)).toBeCloseTo(0.15, 4);
  });
});

describe('CostEstimator — azure_openai overlay', () => {
  test('azure falls back to openai rates when model name matches', () => {
    const azure = estimateCost({
      provider: 'azure_openai',
      model: 'gpt-4o-mini',
      units: { text_input: 1000 },
    });
    const openai = estimateCost({
      provider: 'openai',
      model: 'gpt-4o-mini',
      units: { text_input: 1000 },
    });
    expect(azure.total_micros).toBe(openai.total_micros);
    expect(azure.modeled).toBe(true);
  });
});
