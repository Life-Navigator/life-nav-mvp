/**
 * Outcome Integrity validator (Principle 8).
 *
 * Catches recommendations whose framing optimizes engagement /
 * retention / clicks instead of user outcomes.
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

const ENGAGEMENT_BAIT =
  /\bcheck\s+back\s+(?:tomorrow|hourly|daily)\b|\blog\s+in\s+(?:every\s+day|daily)\s+to\b|\bstreak(?:s)?\s+to\s+(?:unlock|earn)\b/i;

const RETENTION_BAIT =
  /\bupgrade\s+(?:now|today)\s+to\s+keep\b|\bdowngrad(?:ing|e)\s+(?:means|will\s+make)\s+you\s+(?:lose|miss)\b/i;

const CLICK_BAIT =
  /\bdoctors\s+hate\s+(?:this|him|her)\b|\byou\s+won'?t\s+believe\b|\bone\s+weird\s+trick\b/i;

export function validateOutcomeIntegrity(s: GovernanceSubject): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const text = (s.text ?? '') + ' ' + (s.action ?? '');
  if (ENGAGEMENT_BAIT.test(text)) {
    out.push({
      category: 'outcome_integrity',
      severity: 'high',
      rule_id: 'oint.engagement_bait',
      reason: 'Subject promotes platform engagement rather than user outcome.',
      principle: 'outcome_integrity',
    });
  }
  if (RETENTION_BAIT.test(text)) {
    out.push({
      category: 'outcome_integrity',
      severity: 'high',
      rule_id: 'oint.retention_bait',
      reason: 'Subject pressures the user to retain a subscription against their interest.',
      principle: 'outcome_integrity',
    });
  }
  if (CLICK_BAIT.test(text)) {
    out.push({
      category: 'outcome_integrity',
      severity: 'medium',
      rule_id: 'oint.click_bait',
      reason: 'Subject uses click-bait framing.',
      principle: 'outcome_integrity',
    });
  }
  return out;
}

export const __test = { ENGAGEMENT_BAIT, RETENTION_BAIT, CLICK_BAIT, validateOutcomeIntegrity };
