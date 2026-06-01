/**
 * @jest-environment node
 *
 * Cross-domain health graph tests.
 *
 * The graph is a fixed table; the tests assert structural invariants
 * and deterministic narration.
 */

import { __test } from '../cross-domain-health';

const { CROSS_DOMAIN_LINKS, linksFromMetric, linksAffecting, linksToDomain, narrateLink } = __test;

describe('CROSS_DOMAIN_LINKS structural invariants', () => {
  test('every link has a citation', () => {
    for (const l of CROSS_DOMAIN_LINKS) {
      expect(l.citation).toBeDefined();
      expect(l.citation.source.length).toBeGreaterThan(0);
      expect(l.citation.label.length).toBeGreaterThan(0);
    }
  });

  test('downstream domains are constrained to the documented set', () => {
    for (const l of CROSS_DOMAIN_LINKS) {
      expect(['career', 'financial', 'family', 'longevity']).toContain(l.downstream_domain);
    }
  });

  test('magnitudes are constrained to the documented set', () => {
    for (const l of CROSS_DOMAIN_LINKS) {
      expect(['weak', 'moderate', 'strong']).toContain(l.effect_magnitude_label);
    }
  });
});

describe('query helpers', () => {
  test('linksFromMetric finds at least one link for vo2_max', () => {
    expect(linksFromMetric('vo2_max').length).toBeGreaterThan(0);
  });
  test('linksAffecting cognition pulls sleep + HRV', () => {
    const got = linksAffecting('cognition');
    expect(got.some((l) => l.source_metric === 'sleep_duration_min')).toBe(true);
    expect(got.some((l) => l.source_metric === 'hrv')).toBe(true);
  });
  test('linksToDomain longevity has at least 5 entries', () => {
    expect(linksToDomain('longevity').length).toBeGreaterThanOrEqual(5);
  });
});

describe('narrateLink determinism', () => {
  test('same link → byte-identical narration', () => {
    const link = linksFromMetric('vo2_max')[0];
    const a = narrateLink(link);
    const b = narrateLink(link);
    expect(a).toBe(b);
    expect(a).toMatch(/strongly|moderately|weakly/);
  });
});
