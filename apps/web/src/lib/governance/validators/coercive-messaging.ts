/**
 * Coercive Messaging validator (Principle 5 — Human Autonomy).
 *
 * Catches imperative pressure that strips agency. Allowed: "you can
 * consider", "you might", "we suggest". Not allowed: "you must",
 * "you have to", consequence-threats.
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

const IMPERATIVE_PRESSURE = /\byou\s+(?:must|have\s+to|need\s+to|are\s+required\s+to)\b/i;

const CONSEQUENCE_THREAT =
  /\bif\s+you\s+(?:don'?t|do\s+not)\s+[^.,]{1,80}[,.]?\s+(?:you'?ll|you\s+will|then\s+you|then)\s+(?:lose|fail|ruin|destroy|miss|regret|suffer)\b/i;

const PSEUDO_AUTHORITY =
  /\bevery\s+expert\s+agrees\b|\bscience\s+says\s+you\s+must\b|\bthe\s+only\s+(?:right|smart|sensible)\s+choice\b/i;

const SHAME_THREAT =
  /\b(?:smart|responsible|good)\s+(?:people|investors|patients|parents)\s+(?:always|never)\b/i;

export function validateCoerciveMessaging(s: GovernanceSubject): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const text = (s.text ?? '') + ' ' + (s.action ?? '');
  if (IMPERATIVE_PRESSURE.test(text)) {
    out.push({
      category: 'coercive_messaging',
      severity: 'medium',
      rule_id: 'coer.imperative',
      reason: 'Subject uses imperative pressure ("you must/have to") that strips agency.',
      principle: 'human_autonomy',
    });
  }
  if (CONSEQUENCE_THREAT.test(text)) {
    out.push({
      category: 'coercive_messaging',
      severity: 'high',
      rule_id: 'coer.consequence_threat',
      reason: 'Subject threatens a negative consequence to drive action.',
      principle: 'human_autonomy',
    });
  }
  if (PSEUDO_AUTHORITY.test(text)) {
    out.push({
      category: 'coercive_messaging',
      severity: 'medium',
      rule_id: 'coer.pseudo_authority',
      reason: 'Subject uses unfalsifiable appeals to authority.',
      principle: 'human_autonomy',
    });
  }
  if (SHAME_THREAT.test(text)) {
    out.push({
      category: 'coercive_messaging',
      severity: 'medium',
      rule_id: 'coer.shame_threat',
      reason: 'Subject implies the user is irresponsible for not complying.',
      principle: 'human_autonomy',
    });
  }
  return out;
}

export const __test = {
  IMPERATIVE_PRESSURE,
  CONSEQUENCE_THREAT,
  PSEUDO_AUTHORITY,
  SHAME_THREAT,
  validateCoerciveMessaging,
};
