/**
 * Unsafe Health validator (Principle 4 — No Harm).
 *
 * Catches recommendations that should be evaluated by a licensed
 * clinician but are framed as actionable here.
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

const STOP_PRESCRIBED_MEDICATION =
  /\bstop\s+(?:taking|using)\s+(?:your\s+)?(?:medication|prescription|antidepressant|insulin|blood\s+pressure|statin|beta\s+blocker|inhaler)\b/i;

const ALTER_PRESCRIPTION_DOSE =
  /\bdouble\s+(?:the|your)\s+dose\b|\b(?:cut|halve)\s+(?:the|your)\s+dose\s+(?:on|of)\b/i;

const SELF_DIAGNOSIS =
  /\byou\s+(?:probably\s+)?have\s+(?:cancer|diabetes|heart\s+disease|depression|bipolar|adhd|autism|covid)\b/i;

const DELAY_CARE =
  /\b(?:skip|delay|avoid)\s+(?:your|the)\s+(?:doctor|ER|emergency\s+room|appointment|surgery|chemotherapy)\b/i;

const UNSAFE_DOSING_CLAIM =
  /\b\d+\s*(?:mg|g|IU|mcg)\s+(?:per\s+(?:day|kg|lb)|daily)\b.*\b(?:without|no)\s+(?:doctor|physician|clinician)\b/i;

export function validateUnsafeHealth(s: GovernanceSubject): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const text = (s.text ?? '') + ' ' + (s.action ?? '');
  if (STOP_PRESCRIBED_MEDICATION.test(text)) {
    out.push({
      category: 'unsafe_health',
      severity: 'critical',
      rule_id: 'unsafe.stop_medication',
      reason: 'Subject tells the user to stop a prescribed medication without clinician guidance.',
      principle: 'no_harm',
    });
  }
  if (ALTER_PRESCRIPTION_DOSE.test(text)) {
    out.push({
      category: 'unsafe_health',
      severity: 'critical',
      rule_id: 'unsafe.alter_dose',
      reason: 'Subject alters a prescribed dose.',
      principle: 'no_harm',
    });
  }
  if (SELF_DIAGNOSIS.test(text)) {
    out.push({
      category: 'unsafe_health',
      severity: 'high',
      rule_id: 'unsafe.self_diagnosis',
      reason: 'Subject claims a clinical diagnosis without examination.',
      principle: 'no_harm',
    });
  }
  if (DELAY_CARE.test(text)) {
    out.push({
      category: 'unsafe_health',
      severity: 'critical',
      rule_id: 'unsafe.delay_care',
      reason: 'Subject discourages timely medical care.',
      principle: 'no_harm',
    });
  }
  if (UNSAFE_DOSING_CLAIM.test(text)) {
    out.push({
      category: 'unsafe_health',
      severity: 'high',
      rule_id: 'unsafe.dosing_claim',
      reason: 'Subject prescribes a dose without a clinician.',
      principle: 'no_harm',
    });
  }
  return out;
}

export const __test = {
  STOP_PRESCRIBED_MEDICATION,
  ALTER_PRESCRIPTION_DOSE,
  SELF_DIAGNOSIS,
  DELAY_CARE,
  UNSAFE_DOSING_CLAIM,
  validateUnsafeHealth,
};
