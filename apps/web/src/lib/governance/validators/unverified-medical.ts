/**
 * Unverified Medical validator (Principle 6 — Transparency,
 * Principle 4 — No Harm).
 *
 * Catches medical *claims* — "X cures Y", "X prevents Z", "X is
 * proven to" — when the recommendation has no citation. We do not
 * block factual health framing that already carries a citation
 * (Sprint E evidence pipeline), only unbacked medical claims.
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

const MEDICAL_CLAIM =
  /\b(?:cure[ds]?|reverses?|prevents?|treats?|eliminates?|guarantees?\s+to\s+\w+)\s+(?:diabetes|cancer|alzheimer|dementia|depression|anxiety|heart\s+disease|hypertension|covid|chronic\s+fatigue|long\s+covid|autism)\b/i;

const ABSOLUTE_EFFICACY =
  /\b(?:100%\s*(?:effective|guaranteed|cures?|works|prevents?)|guaranteed\s+to\s+(?:cure|prevent|treat|work)|always\s+(?:effective|works|cures?|prevents?)|never\s+fails?)\b/i;

const HORMONE_BIOHACK =
  /\bnatural\s+testosterone\s+(?:replacement|boost(?:er)?)\b|\bsubstitute\s+for\s+(?:HRT|TRT|insulin|statins)\b/i;

const UNAPPROVED_TREATMENT = /\b(?:miracle|breakthrough)\s+(?:treatment|cure|protocol)\b/i;

export function validateUnverifiedMedical(s: GovernanceSubject): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const text = (s.text ?? '') + ' ' + (s.action ?? '');
  const hasCitations = (s.citations?.length ?? 0) > 0;

  if (MEDICAL_CLAIM.test(text) && !hasCitations) {
    out.push({
      category: 'unverified_medical',
      severity: 'high',
      rule_id: 'umed.uncited_claim',
      reason: 'Subject makes a clinical efficacy claim without supporting citations.',
      principle: 'transparency',
    });
  }
  if (ABSOLUTE_EFFICACY.test(text)) {
    out.push({
      category: 'unverified_medical',
      severity: 'high',
      rule_id: 'umed.absolute_efficacy',
      reason: 'Subject claims absolute efficacy — no clinical intervention does this.',
      principle: 'transparency',
    });
  }
  if (HORMONE_BIOHACK.test(text)) {
    out.push({
      category: 'unverified_medical',
      severity: 'high',
      rule_id: 'umed.hormone_substitute',
      reason: 'Subject positions a non-clinical substance as a substitute for hormone therapy.',
      principle: 'no_harm',
    });
  }
  if (UNAPPROVED_TREATMENT.test(text)) {
    out.push({
      category: 'unverified_medical',
      severity: 'medium',
      rule_id: 'umed.miracle_framing',
      reason: 'Subject uses "miracle/breakthrough" framing.',
      principle: 'transparency',
    });
  }
  return out;
}

export const __test = {
  MEDICAL_CLAIM,
  ABSOLUTE_EFFICACY,
  HORMONE_BIOHACK,
  UNAPPROVED_TREATMENT,
  validateUnverifiedMedical,
};
