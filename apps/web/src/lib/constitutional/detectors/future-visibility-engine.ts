/**
 * FutureVisibilityEngine — Sprint L2.
 *
 * Detects future-collapse thinking and generates alternative
 * trajectories WITHOUT promising or guaranteeing outcomes.
 *
 *   "My life is over."          → expand
 *   "There is no future."       → expand
 *   "Nothing will ever be good again." → expand
 *   "There is only one path."   → expand
 *
 * The engine does NOT call an LLM. It returns a small structured set
 * of options the redirection layer composes into copy.
 */

import type { FutureOption, FutureVisibilityResult } from '@/types/constitutional';

const COLLAPSE_PATTERNS: RegExp[] = [
  /\bmy\s+life\s+is\s+over\b/i,
  /\bthere\s+is\s+no\s+future\b/i,
  /\bthere'?s\s+no\s+future\b/i,
  /\bnothing\s+will\s+ever\s+be\s+(?:good|ok|fine)\s+again\b/i,
  /\bthere\s+is\s+only\s+one\s+(?:way|path|option)\b/i,
  /\bi\s+have\s+nothing\s+left\b/i,
  /\bi\s+can'?t\s+come\s+back\s+from\s+this\b/i,
];

// Reusable, non-promissory option scaffolds. Each is deliberately
// generic — the redirection layer fills in domain detail when
// available.
const OPTION_LIBRARY: FutureOption[] = [
  {
    label: 'Stabilize first, then plan',
    description:
      'A common path: take 24–72 hours to rest, eat, and talk to one trusted person. Decisions made after stabilization are more reversible.',
    feasibility_label: 'plausible',
  },
  {
    label: 'Smallest next step',
    description:
      'Instead of picking a destination, pick the next 1–2 hours. Many people discover that paths open after they move once.',
    feasibility_label: 'plausible',
  },
  {
    label: 'Talk to a trusted person',
    description:
      'A spouse, friend, mentor, coach, physician, therapist, counselor, or clergy member. Other humans often see options we cannot see from inside.',
    feasibility_label: 'plausible',
  },
  {
    label: 'Recover an opportunity that still exists',
    description:
      'Most situations preserve more options than they appear to. Naming three options — even unattractive ones — is usually possible.',
    feasibility_label: 'possible',
  },
  {
    label: 'Defer irreversible decisions',
    description:
      'Decisions that are hard to undo (resignation, public statements, large transactions, severing relationships) often look different after a week.',
    feasibility_label: 'plausible',
  },
  {
    label: 'Seek professional support',
    description:
      'Therapists, counselors, and crisis lines are designed to widen visibility precisely when it narrows. In some situations this is the highest-leverage step.',
    feasibility_label: 'plausible',
  },
];

export function assessFutureVisibility(text: string): FutureVisibilityResult {
  const t = text ?? '';
  let triggered: RegExp | undefined;
  for (const r of COLLAPSE_PATTERNS) {
    if (r.test(t)) {
      triggered = r;
      break;
    }
  }
  if (!triggered) {
    return { needs_expansion: false, options: [] };
  }
  return {
    needs_expansion: true,
    reason: `future_collapse_pattern_matched`,
    options: OPTION_LIBRARY,
  };
}

export const __test = { assessFutureVisibility, COLLAPSE_PATTERNS, OPTION_LIBRARY };
