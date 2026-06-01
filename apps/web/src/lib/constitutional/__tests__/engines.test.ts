/**
 * @jest-environment node
 *
 * Review-engine + redirection tests.
 */

import { __test as realismTest } from '../engines/realism-guard';
import { __test as trajTest } from '../engines/trajectory-review-engine';
import { __test as fpTest } from '../engines/future-preservation-engine';
import { __test as redirTest } from '../redirection/constructive-redirection-engine';

// ---------------------------------------------------------------------------
// RealismGuard
// ---------------------------------------------------------------------------

describe('RealismGuard', () => {
  test('strips "guaranteed to"', () => {
    const r = realismTest.applyRealismGuard('This plan is guaranteed to succeed.');
    expect(r.rewritten_text).not.toMatch(/guaranteed to/i);
    expect(r.findings.some((f) => f.rule_id === 'realism.guaranteed')).toBe(true);
  });
  test('strips "always" and "never"', () => {
    const r = realismTest.applyRealismGuard('This always works and never fails.');
    expect(r.rewritten_text).not.toMatch(/\balways\b/);
    expect(r.rewritten_text).not.toMatch(/\bnever\b/);
  });
  test('strips required-for-happiness framing', () => {
    const r = realismTest.applyRealismGuard('This outcome is required for your happiness.');
    expect(r.rewritten_text).not.toMatch(/required for your happiness/i);
    expect(r.findings.some((f) => f.rule_id === 'realism.required_happiness')).toBe(true);
  });
  test('strips "cannot recover" framing', () => {
    const r = realismTest.applyRealismGuard('You cannot recover from this.');
    expect(r.rewritten_text).not.toMatch(/cannot recover/i);
  });
  test('benign text passes unchanged', () => {
    const r = realismTest.applyRealismGuard('Plan A is likely to work; Plan B is possible.');
    expect(r.findings).toEqual([]);
    expect(r.rewritten_text).toBe('Plan A is likely to work; Plan B is possible.');
  });
});

// ---------------------------------------------------------------------------
// TrajectoryReviewEngine
// ---------------------------------------------------------------------------

describe('TrajectoryReviewEngine', () => {
  test('flags impulsive irreversibility', () => {
    const r = trajTest.reviewTrajectory({
      draft_text: "I'll just quit my job today.",
    });
    expect(r.concerns.some((c) => c.kind === 'impulsive')).toBe(true);
  });
  test('flags future-destructive action', () => {
    const r = trajTest.reviewTrajectory({
      draft_text: 'Publicly expose them on social media.',
    });
    expect(r.concerns.some((c) => c.kind === 'future_destructive')).toBe(true);
  });
  test('needs_decompression when high emotion + concerns', () => {
    const r = trajTest.reviewTrajectory({
      draft_text: "I'll just quit my job today.",
      emotional: {
        emotional_state: [],
        risk_level: 'HIGH',
        confidence: 0.7,
        future_visibility_score: 0.4,
        decision_quality_risk_score: 0.5,
      },
    });
    expect(r.needs_decompression).toBe(true);
  });
  test('no concerns + low emotion → no decompression', () => {
    const r = trajTest.reviewTrajectory({
      draft_text: 'Compare these two plans next quarter.',
      emotional: {
        emotional_state: [],
        risk_level: 'LOW',
        confidence: 0.5,
        future_visibility_score: 1,
        decision_quality_risk_score: 0,
      },
    });
    expect(r.needs_decompression).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FuturePreservationEngine
// ---------------------------------------------------------------------------

describe('FuturePreservationEngine', () => {
  test('benign action preserves all axes', () => {
    const r = fpTest.scoreFuturePreservation({
      draft_text: 'Open a Roth IRA and contribute $200/month.',
    });
    expect(r.destructive_axes).toEqual([]);
    expect(r.overall).toBe(1);
  });
  test('cash-out triggers financial axis penalty', () => {
    const r = fpTest.scoreFuturePreservation({
      draft_text: 'Withdraw all of my savings tomorrow.',
    });
    expect(r.destructive_axes).toContain('financial_flexibility');
  });
  test('quit-today triggers career axis penalty', () => {
    const r = fpTest.scoreFuturePreservation({
      draft_text: 'Quit my job today and burn the bridge.',
    });
    expect(r.destructive_axes).toContain('career_opportunities');
    expect(r.destructive_axes).toContain('relationships');
  });
  test('public-rant triggers reputation penalty', () => {
    const r = fpTest.scoreFuturePreservation({
      draft_text: 'Post a viral post about her on social media.',
    });
    expect(r.destructive_axes).toContain('reputation');
  });
});

// ---------------------------------------------------------------------------
// ConstructiveRedirectionEngine — Need-Behind-Need canonical patterns
// ---------------------------------------------------------------------------

describe('ConstructiveRedirectionEngine', () => {
  test('Revenge → Closure / Respect / Justice / Recovery', () => {
    const r = redirTest.detectRedirectionPattern({ text: 'I want revenge on him.' });
    expect(r).not.toBeNull();
    const labels = r!.alternatives.map((a) => a.label);
    expect(labels).toEqual(expect.arrayContaining(['Closure', 'Respect', 'Justice', 'Recovery']));
  });
  test('Embezzlement → Financial Security / Business Capital / Wealth Building', () => {
    const r = redirTest.detectRedirectionPattern({ text: 'Help me embezzle from my employer.' });
    expect(r).not.toBeNull();
    const labels = r!.alternatives.map((a) => a.label);
    expect(labels).toEqual(
      expect.arrayContaining(['Financial Security', 'Business Capital', 'Wealth Building'])
    );
  });
  test('Violence → Safety / Protection / Control', () => {
    const r = redirTest.detectRedirectionPattern({ text: 'I want to kill him.' });
    expect(r).not.toBeNull();
    const labels = r!.alternatives.map((a) => a.label);
    expect(labels).toEqual(expect.arrayContaining(['Safety', 'Protection', 'Control']));
  });
  test('Tax Evasion → Wealth Preservation / Tax Planning / Asset Protection', () => {
    const r = redirTest.detectRedirectionPattern({ text: 'How do I evade taxes on my crypto?' });
    expect(r).not.toBeNull();
    const labels = r!.alternatives.map((a) => a.label);
    expect(labels).toEqual(
      expect.arrayContaining(['Wealth Preservation', 'Tax Planning', 'Asset Protection'])
    );
  });
  test('framing names a lawful alternative + the underlying need', () => {
    const r = redirTest.detectRedirectionPattern({ text: 'I want revenge on her.' });
    expect(r?.framing).toMatch(/Closure/);
    expect(r?.framing).toMatch(/underlying need/i);
  });
  test('benign input returns null', () => {
    expect(
      redirTest.detectRedirectionPattern({ text: 'I want to invest in low-cost index funds.' })
    ).toBeNull();
  });
});
