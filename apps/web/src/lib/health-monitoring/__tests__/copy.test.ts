/**
 * @jest-environment node
 *
 * Locks in the non-diagnostic copy guarantee. If a future edit adds a
 * banned phrase to any copy entry, this test fails.
 */

import { copyFor, containsDisallowed, DISALLOWED_PHRASES } from '../copy';
import type { AlertRuleKey, AlertSeverity } from '@/types/health-monitoring';

const ALL_RULES: AlertRuleKey[] = [
  'rhr_up_sleep_down',
  'bp_trend_worsening',
  'weight_sudden_drop',
  'recovery_score_collapse',
  'concerning_combo',
  'lab_out_of_range',
];
const ALL_SEVERITIES: AlertSeverity[] = ['info', 'watch', 'warn', 'urgent'];

describe('non-diagnostic copy guarantees', () => {
  it('disallowed phrase list is non-empty (sanity check)', () => {
    expect(DISALLOWED_PHRASES.length).toBeGreaterThan(0);
  });

  it('every entry includes a "consider contacting your physician" type recommendation', () => {
    for (const rule of ALL_RULES) {
      for (const sev of ALL_SEVERITIES) {
        const c = copyFor(rule, sev);
        expect(c.recommended_next_step.toLowerCase()).toMatch(/(physician|doctor|provider)/);
      }
    }
  });

  it('no headline / body / recommendation contains diagnostic language', () => {
    for (const rule of ALL_RULES) {
      for (const sev of ALL_SEVERITIES) {
        const c = copyFor(rule, sev);
        expect(containsDisallowed(c.headline)).toBe(false);
        expect(containsDisallowed(c.body)).toBe(false);
        expect(containsDisallowed(c.recommended_next_step)).toBe(false);
      }
    }
  });

  it('containsDisallowed flags an obvious diagnostic phrase', () => {
    expect(containsDisallowed('You have hypertension')).toBe(true);
  });
});
