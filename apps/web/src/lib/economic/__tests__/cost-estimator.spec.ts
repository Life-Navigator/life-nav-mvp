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

describe('Regression — governed chat must not trip the unmodeled ceiling', () => {
  // Beta-20: governed-route estimated chat cost with the alias `gemini-default`,
  // which is NOT a RATE_TABLE key → modeled:false → ~$0.39/turn ceiling →
  // the $1.00/day per-user budget was exhausted in ~2 turns (110/130 live
  // chat calls returned 429 budget_exceeded). The fix estimates with the
  // concrete model the edge function actually runs (gemini-2.5-flash).
  const DAILY_BUDGET_MICROS = 1_000_000; // $1.00, BETA_USER_BUDGET_DEFAULTS.daily_micros

  test('the OLD `gemini-default` alias was unmodeled and ~1000x too expensive', () => {
    const bug = estimateCost({
      provider: 'gemini',
      model: 'gemini-default', // the pre-fix alias
      units: { text_input: 1500, text_output: 800 },
    });
    expect(bug.modeled).toBe(false);
    expect(bug.total_micros).toBeGreaterThan(300_000); // ~$0.39 ceiling
    // Only ~2 turns fit in the daily budget — the observed 429 wall.
    expect(Math.floor(DAILY_BUDGET_MICROS / bug.total_micros)).toBeLessThanOrEqual(3);
  });

  test('the FIXED chat-path model (gemini-2.5-flash) is modeled and sub-cent per turn', () => {
    const fixed = estimateCost({
      provider: 'gemini',
      model: 'gemini-2.5-flash', // matches graphrag-query/index.ts generation model
      units: { text_input: 1500, text_output: 800 },
    });
    expect(fixed.modeled).toBe(true);
    // 1500/1000*75 + 800/1000*300 = 112.5→113 + 240 = ~353 micros
    expect(fixed.total_micros).toBeLessThan(1_000);
    // A real beta conversation (hundreds of turns/day) now fits comfortably.
    expect(Math.floor(DAILY_BUDGET_MICROS / fixed.total_micros)).toBeGreaterThan(500);
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
