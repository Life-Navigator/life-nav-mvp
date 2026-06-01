/**
 * Harm-to-others validator (Principle 4 — No Harm).
 *
 * Blocks recommendations that direct the user toward harming,
 * harassing, stalking, exploiting, or coercing another person.
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

const VIOLENCE =
  /\b(?:assault|attack|hit|beat|punch|stab|shoot|kill|murder)\s+(?:him|her|them|someone|your\s+(?:spouse|partner|ex))\b/i;

const STALKING =
  /\btrack\s+(?:without\s+consent|secretly)\b|\b(monitor|surveil|spy\s+on)\s+(?:your\s+(?:ex|partner|spouse)|someone)\b/i;

const HARASSMENT =
  /\bsend\s+(?:repeat(?:ed|ing)?|continuous)\s+(?:messages|texts|emails)\s+to\b|\bharass(?:ing)?\s+(?:them|him|her)\b/i;

const COERCION =
  /\bblackmail(?:ing)?\b|\bthreaten\s+to\s+(?:expose|share|leak)\b|\bforce\s+(?:them|him|her)\s+to\b/i;

const REVENGE =
  /\bget\s+revenge\b|\bdestroy\s+(?:his|her|their)\s+(?:reputation|career|marriage)\b/i;

export function validateHarmToOthers(s: GovernanceSubject): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const text = (s.text ?? '') + ' ' + (s.action ?? '');
  if (VIOLENCE.test(text)) {
    out.push({
      category: 'harm_to_others',
      severity: 'critical',
      rule_id: 'hto.violence',
      reason: 'Subject directs violence at another person.',
      principle: 'no_harm',
    });
  }
  if (STALKING.test(text)) {
    out.push({
      category: 'harm_to_others',
      severity: 'critical',
      rule_id: 'hto.stalking',
      reason: 'Subject describes stalking or non-consensual surveillance.',
      principle: 'no_harm',
    });
  }
  if (HARASSMENT.test(text)) {
    out.push({
      category: 'harm_to_others',
      severity: 'high',
      rule_id: 'hto.harassment',
      reason: 'Subject is a harassment pattern.',
      principle: 'no_harm',
    });
  }
  if (COERCION.test(text)) {
    out.push({
      category: 'harm_to_others',
      severity: 'critical',
      rule_id: 'hto.coercion',
      reason: 'Subject describes coercion or blackmail.',
      principle: 'no_harm',
    });
  }
  if (REVENGE.test(text)) {
    out.push({
      category: 'harm_to_others',
      severity: 'high',
      rule_id: 'hto.revenge',
      reason: 'Subject is revenge-oriented.',
      principle: 'no_harm',
    });
  }
  return out;
}

export const __test = {
  VIOLENCE,
  STALKING,
  HARASSMENT,
  COERCION,
  REVENGE,
  validateHarmToOthers,
};
