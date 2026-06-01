/**
 * User Advocacy validator (Principle 1).
 *
 * Catches optimization framings that target a non-user beneficiary.
 * Allowed: "this benefits you because…". Not allowed: "this helps
 * the employer / advertiser / government / vendor and incidentally
 * helps you".
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

const NON_USER_BENEFICIARY =
  /\bthis\s+benefits\s+(?:the\s+)?(?:employer|government|advertiser|vendor|insurer|payer|sponsor)\b/i;

const OPTIMIZE_FOR_THIRD_PARTY =
  /\b(?:optimize[ds]?|optimised?|optimising|optimizing|engineer(?:ed|s|ing)?)\s+(?:this\s+plan|the\s+plan|the\s+outcome|the\s+recommendation)\s+for\s+(?:the\s+)?(?:employer|advertiser|vendor|insurer|payer|partner|sponsor|government)\b/i;

const HIDDEN_BENEFICIARY =
  /\bthe\s+real\s+beneficiary\s+is\s+(?:the\s+)?(?:employer|advertiser|vendor|insurer|partner)\b/i;

export function validateUserAdvocacy(s: GovernanceSubject): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const text = (s.text ?? '') + ' ' + (s.action ?? '');
  if (NON_USER_BENEFICIARY.test(text)) {
    out.push({
      category: 'user_advocacy',
      severity: 'high',
      rule_id: 'adv.non_user_beneficiary',
      reason: 'Subject explicitly frames a non-user as the beneficiary.',
      principle: 'user_advocacy',
    });
  }
  if (OPTIMIZE_FOR_THIRD_PARTY.test(text)) {
    out.push({
      category: 'user_advocacy',
      severity: 'critical',
      rule_id: 'adv.optimized_for_third_party',
      reason: 'Subject optimizes for a third party rather than the user.',
      principle: 'user_advocacy',
    });
  }
  if (HIDDEN_BENEFICIARY.test(text)) {
    out.push({
      category: 'user_advocacy',
      severity: 'critical',
      rule_id: 'adv.hidden_beneficiary',
      reason: 'Subject reveals a hidden non-user beneficiary.',
      principle: 'user_advocacy',
    });
  }
  return out;
}

export const __test = {
  NON_USER_BENEFICIARY,
  OPTIMIZE_FOR_THIRD_PARTY,
  HIDDEN_BENEFICIARY,
  validateUserAdvocacy,
};
