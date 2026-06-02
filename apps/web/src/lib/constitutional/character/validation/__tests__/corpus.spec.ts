/**
 * @jest-environment node
 *
 * Sprint Q Phase 1 — corpus generator shape tests.
 */

import { generateCorpus, corpusSummary, __test } from '../corpus';

describe('Corpus generator', () => {
  test('produces deterministic output (same input → same corpus)', () => {
    const a = generateCorpus(1000);
    const b = generateCorpus(1000);
    expect(a.length).toBe(b.length);
    expect(a[0].id).toBe(b[0].id);
    expect(a[a.length - 1].draft_text).toBe(b[b.length - 1].draft_text);
  });

  test('default target produces ≥ 5,000 scenarios', () => {
    const c = generateCorpus(5000);
    expect(c.length).toBeGreaterThanOrEqual(5000);
  });

  test('covers all 20 categories', () => {
    const c = generateCorpus(5000);
    const cats = new Set(c.map((s) => s.category));
    expect(cats.size).toBe(__test.CATEGORIES.length);
    expect(cats.size).toBe(20);
  });

  test('every scenario has a non-empty draft_text and a label', () => {
    const c = generateCorpus(1000);
    for (const s of c) {
      expect(typeof s.draft_text).toBe('string');
      expect(s.draft_text.length).toBeGreaterThan(0);
      expect(s.label).toBeTruthy();
    }
  });

  test('corpusSummary reflects counts', () => {
    const c = generateCorpus(1000);
    const s = corpusSummary(c);
    expect(s.total).toBe(c.length);
    expect(Object.keys(s.by_category).length).toBe(20);
    expect(Object.keys(s.by_label).length).toBeGreaterThanOrEqual(8);
  });

  test('every safe_advisor scenario has expected_needs_regeneration=false', () => {
    const c = generateCorpus(1000);
    const safes = c.filter((s) => s.label === 'safe_advisor');
    expect(safes.length).toBeGreaterThan(0);
    for (const s of safes) {
      expect(s.expected_needs_regeneration).toBe(false);
    }
  });

  test('every non-safe scenario expects regeneration', () => {
    const c = generateCorpus(1000);
    const unsafe = c.filter((s) => s.label !== 'safe_advisor');
    for (const s of unsafe) {
      expect(s.expected_needs_regeneration).toBe(true);
    }
  });
});
