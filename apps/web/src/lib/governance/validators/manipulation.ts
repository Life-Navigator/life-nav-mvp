/**
 * Manipulation validator (Principle 5 — Human Autonomy).
 *
 * Blocks copy that pressures, shames, guilts, or uses dark patterns.
 * The user remains the decision maker.
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

const PRESSURE =
  /\b(only|just)\s+\d+\s+(?:seats?|spots?|left|remaining)\b|\b(act|decide|claim)\s+now\s+or\b|\bnow\s+or\s+never\b|\blast\s+chance\b|\bdon'?t\s+miss\s+out\b/i;

const SHAME =
  /\byou\s+should\s+be\s+ashamed\b|\bembarrass(?:ing|ed)\b.*\byourself\b|\bshame\s+on\s+you\b/i;

const GUILT =
  /\byou'?re\s+letting\s+(?:your|the)\s+(?:family|kids|spouse|partner)\s+down\b|\bif\s+you\s+(?:really\s+)?(?:cared|loved)\b/i;

const FOMO_DARK_PATTERN =
  /\b(?:fear|afraid)\s+of\s+missing\s+out\b|\bbefore\s+it'?s\s+too\s+late\b/i;

const FALSE_URGENCY = /\bthis\s+offer\s+expires\s+in\s+\d+\s+(?:minutes?|hours?)\b/i;

export function validateManipulation(s: GovernanceSubject): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const text = (s.text ?? '') + ' ' + (s.action ?? '');
  if (PRESSURE.test(text) || FALSE_URGENCY.test(text)) {
    out.push({
      category: 'manipulation',
      severity: 'high',
      rule_id: 'manip.pressure_tactic',
      reason: 'Subject uses urgency/pressure tactics to override deliberation.',
      principle: 'human_autonomy',
    });
  }
  if (SHAME.test(text)) {
    out.push({
      category: 'manipulation',
      severity: 'high',
      rule_id: 'manip.shame',
      reason: 'Subject uses shaming language.',
      principle: 'human_autonomy',
    });
  }
  if (GUILT.test(text)) {
    out.push({
      category: 'manipulation',
      severity: 'high',
      rule_id: 'manip.guilt',
      reason: 'Subject uses guilt-based persuasion.',
      principle: 'human_autonomy',
    });
  }
  if (FOMO_DARK_PATTERN.test(text)) {
    out.push({
      category: 'manipulation',
      severity: 'medium',
      rule_id: 'manip.fomo',
      reason: 'Subject relies on fear-of-missing-out framing.',
      principle: 'human_autonomy',
    });
  }
  return out;
}

export const __test = {
  PRESSURE,
  SHAME,
  GUILT,
  FOMO_DARK_PATTERN,
  FALSE_URGENCY,
  validateManipulation,
};
