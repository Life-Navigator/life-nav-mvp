/**
 * Self-harm validator (Principle 4 — No Harm).
 *
 * Triggers when the subject would *encourage* self-harm. The
 * platform redirects to support resources. NOTE: this validator is
 * tuned to catch encouragement, not discussion or help-seeking —
 * a user mentioning past self-harm in their journal is not a
 * violation, because the validator runs on outgoing recommendations,
 * not user input.
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

const ENCOURAGE_SELF_HARM =
  /\b(?:you\s+should\s+)?(?:hurt|harm|cut|kill)\s+yourself\b|\b(end|take)\s+your\s+(?:own\s+)?life\b|\bsuicid(?:e|al)\s+(?:is|would\s+be)\s+(?:the\s+)?(?:answer|solution|best)\b/i;

const ENCOURAGE_DISORDERED_PATTERN =
  /\bskip\s+all\s+meals\b|\bstarve\s+yourself\b|\bpurg(?:e|ing)\s+is\s+(?:fine|ok)\b/i;

const ENCOURAGE_SUBSTANCE_ABUSE =
  /\btake\s+more\s+than\s+the\s+prescribed\s+dose\b|\bcombine\s+(?:alcohol|opioids|benzodiazepines)\s+with\b/i;

export function validateSelfHarm(s: GovernanceSubject): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const text = (s.text ?? '') + ' ' + (s.action ?? '');
  if (ENCOURAGE_SELF_HARM.test(text)) {
    out.push({
      category: 'self_harm',
      severity: 'critical',
      rule_id: 'sh.encourage',
      reason: 'Subject encourages self-harm.',
      principle: 'no_harm',
      safer_alternatives: [
        { label: 'Reach out to a trusted person' },
        { label: 'Contact a local crisis line' },
        { label: 'Visit a nearby emergency department if you are in danger' },
      ],
    });
  }
  if (ENCOURAGE_DISORDERED_PATTERN.test(text)) {
    out.push({
      category: 'self_harm',
      severity: 'critical',
      rule_id: 'sh.disordered_eating',
      reason: 'Subject encourages a disordered-eating pattern.',
      principle: 'no_harm',
    });
  }
  if (ENCOURAGE_SUBSTANCE_ABUSE.test(text)) {
    out.push({
      category: 'self_harm',
      severity: 'critical',
      rule_id: 'sh.substance_abuse',
      reason: 'Subject encourages substance misuse or dangerous combination.',
      principle: 'no_harm',
    });
  }
  return out;
}

export const __test = {
  ENCOURAGE_SELF_HARM,
  ENCOURAGE_DISORDERED_PATTERN,
  ENCOURAGE_SUBSTANCE_ABUSE,
  validateSelfHarm,
};
