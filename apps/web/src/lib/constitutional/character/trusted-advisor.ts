/**
 * Trusted Advisor Test — Sprint N.3 Phase 4.
 *
 * Ask:
 *
 *   "Would a wise, ethical, highly competent advisor be comfortable
 *    giving this guidance to someone they genuinely care about?"
 *
 * The detection is heuristic: a wise advisor would object to
 * patterns that a regulator might not flag but a thoughtful mentor
 * would never put their name to.
 *
 * Concerns produced here flow into the character review's
 * `needs_regeneration` decision and into the audit chain.
 */

import type { TrustedAdvisorResult } from './types';

interface Concern {
  pattern: RegExp;
  reason: string;
}

const CONCERNS: ReadonlyArray<Concern> = Object.freeze([
  // Irreversibility without tradeoffs
  {
    pattern:
      /\b(?:just\s+(?:quit|resign|leave|divorce|sell)|burn\s+(?:the\s+)?(?:bridges?|boats?)|never\s+look\s+back)\b/gi,
    reason: 'Recommends irreversible action without surfacing tradeoffs or alternatives.',
  },
  // Single-source confidence
  {
    pattern: /\b(?:trust\s+me|i\s+promise|believe\s+me|on\s+my\s+word)\b/gi,
    reason: 'Asks the user to take the recommendation on authority alone.',
  },
  // Outcome guarantees
  {
    pattern:
      /\b(?:guaranteed\s+to\s+work|definitely\s+will|certain\s+to\s+succeed|cannot\s+fail|sure\s+thing)\b/gi,
    reason: 'Guarantees an outcome that depends on factors the user controls.',
  },
  // Absence of professional referral on serious topics
  {
    pattern:
      /\b(?:diagnose|cure|treat)\s+(?:your|the)\s+(?:depression|anxiety|condition|illness)\b/gi,
    reason: 'Provides clinical guidance without a clinician referral.',
  },
  {
    pattern:
      /\b(?:represent\s+yourself|skip\s+the\s+lawyer|don'?t\s+need\s+(?:an?\s+)?attorney)\b/gi,
    reason: 'Advises against professional legal counsel in a legal matter.',
  },
  // Avoidance of difficult truth
  {
    pattern:
      /\b(?:i'?ll\s+just\s+tell\s+you\s+what\s+you\s+want\s+to\s+hear|let'?s\s+not\s+talk\s+about|skip\s+the\s+hard\s+parts)\b/gi,
    reason: 'Explicitly avoids surfacing hard truths.',
  },
  // Dependence creation
  {
    pattern:
      /\b(?:you\s+(?:need|can\s+only)\s+(?:rely|depend)\s+on\s+me|come\s+to\s+me\s+for\s+(?:every|all)\s+decision)\b/gi,
    reason: 'Encourages dependence on the platform rather than user agency.',
  },
  // Coercion / pressure
  {
    pattern:
      /\b(?:you\s+(?:must|have\s+to|need\s+to)\s+(?:decide|act)\s+(?:right\s+now|today|immediately))\b/gi,
    reason: 'Creates artificial time pressure to force a decision.',
  },
]);

export interface TrustedAdvisorInputs {
  draft_text: string;
  /** Optional subject kind — clinical topics raise the bar. */
  topic?: 'health' | 'legal' | 'financial' | 'family' | 'other';
}

export function trustedAdvisorTest(inputs: TrustedAdvisorInputs): TrustedAdvisorResult {
  const concerns: string[] = [];
  for (const c of CONCERNS) {
    const re = new RegExp(c.pattern.source, c.pattern.flags);
    if (re.test(inputs.draft_text)) concerns.push(c.reason);
  }

  // Topic-specific obligations.
  if (inputs.topic === 'health' || inputs.topic === 'legal' || inputs.topic === 'financial') {
    // Allow an optional modifier between "a/your" and the professional
    // noun ("a licensed attorney", "a fee-only financial advisor",
    // "your primary care physician", etc.). Also handle inflections:
    // "talk", "talking", "consult", "consulting", "take that to a ...".
    const hasReferral =
      /\b(?:talk(?:ing)?\s+to|consult(?:ing)?|bring\s+(?:this|it|that)\s+to|reach(?:ing)?\s+out\s+to|take\s+(?:this|it|that|both)\s+to|see\s+a)\s+(?:a\s+|your\s+|an?\s+)?(?:[a-z][a-z-]+\s+){0,3}(?:doctor|physician|clinician|lawyer|attorney|financial\s+advisor|cpa|counselor|therapist|psychiatrist|mediator|coach|trusted\s+professional)\b/i.test(
        inputs.draft_text
      ) ||
      /\b(?:consult\s+a\s+professional|seek\s+professional\s+advice|professional\s+referral|qualified\s+professional)\b/i.test(
        inputs.draft_text
      );
    if (!hasReferral) {
      concerns.push(
        `Topic is ${inputs.topic}: the response should point to a qualified professional and does not.`
      );
    }
  }

  return { passes: concerns.length === 0, concerns };
}

export const __test = { CONCERNS };
