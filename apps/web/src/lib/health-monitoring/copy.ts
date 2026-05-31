/**
 * Vetted non-diagnostic copy bank for the health alert engine.
 *
 * Every string here has been reviewed for:
 *   - no diagnosis ("you have X", "X disease", "X disorder")
 *   - no dosage / treatment instruction
 *   - no guaranteed outcomes
 *   - a clear "consider contacting your physician" recommended next step
 *
 * The DISALLOWED_PHRASES list is enforced by jest in copy.test.ts so a
 * future edit can't accidentally introduce diagnostic language.
 */

import type { AlertRuleKey, AlertSeverity } from '@/types/health-monitoring';

export const DISALLOWED_PHRASES: string[] = [
  // Diagnostic patterns
  'you have',
  'you suffer from',
  'diagnosed with',
  'disease',
  'disorder',
  'syndrome',
  'condition is',
  // Treatment / dosage patterns
  'take a',
  'should take',
  'increase your dose',
  'decrease your dose',
  'stop taking',
  'milligrams',
  'mg of',
  // Guarantees
  'guaranteed to',
  'will cure',
  'will fix',
  'definitely will',
  'always means',
  // Outright reassurance that could mislead
  'nothing to worry about',
  'completely safe',
];

interface CopyEntry {
  headline: string;
  body: string;
  recommended_next_step: string;
}

/**
 * Per-(rule_key, severity) copy. Lookup is forgiving: if no severity-specific
 * entry exists we fall back to `info`. The engine always falls back to a
 * generic non-diagnostic phrase if absolutely no entry is found.
 */
const COPY: Record<AlertRuleKey, Partial<Record<AlertSeverity, CopyEntry>>> = {
  rhr_up_sleep_down: {
    watch: {
      headline: 'Your resting heart rate has been trending higher while sleep is trending shorter',
      body: "Over the past week, your average resting heart rate has crept up and your sleep has been a bit shorter than your usual. Patterns like this can sometimes reflect stress, illness onset, or training load — they're worth a closer look.",
      recommended_next_step:
        'Consider lighter activity for a few days, and contact your physician if this pattern continues or you notice other symptoms.',
    },
    warn: {
      headline: 'A multi-day shift in your resting heart rate and sleep may warrant review',
      body: 'Your resting heart rate has risen meaningfully while your sleep has dropped over the past week.',
      recommended_next_step:
        'Consider contacting your physician to discuss whether this trend warrants follow-up.',
    },
  },
  bp_trend_worsening: {
    watch: {
      headline: 'Your blood pressure readings have been higher than your usual range',
      body: "A few of your recent readings are above what's typically considered the normal range for adults. Single readings can be noisy — but a pattern of higher readings is worth tracking.",
      recommended_next_step:
        'Consider re-measuring after a few minutes of rest, and contact your physician if elevated readings continue.',
    },
    warn: {
      headline: 'Multiple recent blood pressure readings are above the typical adult range',
      body: 'Several recent readings are above the typical adult normal range. That is a pattern worth reviewing rather than a one-off.',
      recommended_next_step: 'Consider contacting your physician about this trend.',
    },
  },
  weight_sudden_drop: {
    watch: {
      headline: 'Your weight has dropped more than expected over a short window',
      body: 'Your recent measurements show a faster drop than your usual variability. If this is unintentional, it may warrant a conversation with your physician.',
      recommended_next_step:
        'If this was unplanned, consider contacting your physician to discuss further.',
    },
    warn: {
      headline: 'A meaningful unintentional weight change may warrant review',
      body: 'A significant change in body weight over a short window can have many causes. If this drop is unintentional, it is generally worth a clinical review.',
      recommended_next_step: 'Consider contacting your physician to discuss this change.',
    },
  },
  recovery_score_collapse: {
    watch: {
      headline: 'Your recovery scores have been low for several days in a row',
      body: 'A few consecutive days of low recovery can mean accumulated stress, missed sleep, an early illness, or simply overreach. Many people notice a clear cause when they look back.',
      recommended_next_step:
        'Consider an easier day or two, hydrate, and contact your physician if other symptoms appear.',
    },
  },
  concerning_combo: {
    watch: {
      headline: 'A combination of fatigue, sleep, and stress signals is trending unfavorably',
      body: 'No single measurement here is alarming, but several together (recovery, energy, sleep, stress) have been moving in the wrong direction at the same time.',
      recommended_next_step:
        'Consider reviewing your past week and contacting your physician if the pattern continues or you notice other symptoms.',
    },
  },
  lab_out_of_range: {
    watch: {
      headline: 'Some of your recent lab results are outside the reference range',
      body: 'Your most recent lab panel includes one or more values flagged outside the reference range your lab uses. Single results often warrant a recheck before any conclusions are drawn.',
      recommended_next_step:
        'Your physician is the right person to interpret these results — consider scheduling a follow-up conversation.',
    },
    urgent: {
      headline: 'A recent lab result is flagged as critical',
      body: 'One of your recent lab results is flagged as critical by your lab. Critical flags vary by test and are not in themselves a diagnosis — but they generally warrant prompt physician follow-up.',
      recommended_next_step: 'Please contact your physician promptly to review this result.',
    },
  },
};

const GENERIC: CopyEntry = {
  headline: 'A recent health-data trend may warrant review',
  body: 'Your recent trend in this measurement is outside your typical pattern.',
  recommended_next_step: 'Consider contacting your physician to discuss this further.',
};

export function copyFor(rule: AlertRuleKey, severity: AlertSeverity): CopyEntry {
  return COPY[rule]?.[severity] ?? COPY[rule]?.info ?? GENERIC;
}

/**
 * Audit helper used by tests + the engine: returns true if `text` contains
 * any of the disallowed phrases (case-insensitive substring match).
 */
export function containsDisallowed(text: string): boolean {
  const t = text.toLowerCase();
  return DISALLOWED_PHRASES.some((p) => t.includes(p));
}
