/**
 * Illegal Activity validator (Principle 3 — Legal Compliance).
 *
 * We pursue maximum lawful advantage. We do not help with illegal
 * activity. The validator catches explicit pointers to crime; if
 * lawful alternatives exist, the engine surfaces them.
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

const CRIMINAL_VERBS =
  /\b(?:traffic|smuggle|launder|forge|counterfeit|burglarize|carjack|extort|kidnap|hack\s+into|break\s+into)\b/i;

const REGULATORY_AVOIDANCE =
  /\b(?:avoid|evade)\s+(?:KYC|AML|FinCEN|FATCA|sanction(s)?|export\s+control)\b|\bstructur(?:e|ing)\s+(?:deposits|transactions)\s+to\s+avoid\b/i;

const ILLEGAL_OPERATIONS =
  /\bpiracy\s+ring\b|\bpump\s+and\s+dump\b|\binsider\s+trad(?:e|ing)\b|\bbribe\s+(?:an?\s+)?(?:official|inspector|regulator)\b/i;

const CONTROLLED_SUBSTANCE_PROHIBITED =
  /\bsell\s+(?:controlled|illicit)\s+drugs\b|\boperate\s+a\s+drug\s+(?:lab|operation)\b/i;

export function validateIllegalActivity(s: GovernanceSubject): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const text = (s.text ?? '') + ' ' + (s.action ?? '');
  if (CRIMINAL_VERBS.test(text)) {
    out.push({
      category: 'illegal_activity',
      severity: 'critical',
      rule_id: 'illegal.criminal_verb',
      reason: 'Subject names a criminal action.',
      principle: 'legal_compliance',
    });
  }
  if (REGULATORY_AVOIDANCE.test(text)) {
    out.push({
      category: 'illegal_activity',
      severity: 'critical',
      rule_id: 'illegal.regulatory_avoidance',
      reason: 'Subject describes avoidance of legally required reporting or controls.',
      principle: 'legal_compliance',
    });
  }
  if (ILLEGAL_OPERATIONS.test(text)) {
    out.push({
      category: 'illegal_activity',
      severity: 'critical',
      rule_id: 'illegal.operations',
      reason: 'Subject describes a market-abuse or bribery operation.',
      principle: 'legal_compliance',
    });
  }
  if (CONTROLLED_SUBSTANCE_PROHIBITED.test(text)) {
    out.push({
      category: 'illegal_activity',
      severity: 'critical',
      rule_id: 'illegal.controlled_substances',
      reason: 'Subject describes illicit controlled-substance operations.',
      principle: 'legal_compliance',
    });
  }
  return out;
}

export const __test = {
  CRIMINAL_VERBS,
  REGULATORY_AVOIDANCE,
  ILLEGAL_OPERATIONS,
  CONTROLLED_SUBSTANCE_PROHIBITED,
  validateIllegalActivity,
};
