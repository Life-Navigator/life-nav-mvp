/**
 * Transparency validator (Principle 6 — Transparency).
 *
 * Every recommendation must expose assumptions, confidence, evidence,
 * uncertainty, tradeoffs. The validator runs over the existing
 * subject envelope (citations, assumptions, confidence, tradeoffs)
 * surfaced by Sprint E and friends.
 *
 * Missing pieces emit a low/medium violation — the engine does not
 * block on transparency alone (an upstream re-route happens via the
 * verdict instead), but the policy_check is recorded.
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

// Substantive subjects need transparency. We exempt simple
// notification-style messages and discovery prompts.
const TRANSPARENCY_REQUIRED_KINDS = new Set([
  'recommendation',
  'provider_recommendation',
  'arcana_recommendation',
  'optimizer_recommendation',
  'partner_recommendation',
  'simulation_output',
  'probability_output',
]);

export function validateTransparency(s: GovernanceSubject): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  if (!TRANSPARENCY_REQUIRED_KINDS.has(s.kind)) return out;

  if (!s.citations || s.citations.length === 0) {
    out.push({
      category: 'transparency',
      severity: 'medium',
      rule_id: 'trans.no_citations',
      reason: 'Recommendation has no citations attached.',
      principle: 'transparency',
    });
  }
  if (!s.assumptions || s.assumptions.length === 0) {
    out.push({
      category: 'transparency',
      severity: 'low',
      rule_id: 'trans.no_assumptions',
      reason: 'Recommendation does not enumerate its assumptions.',
      principle: 'transparency',
    });
  }
  if (typeof s.confidence !== 'number') {
    out.push({
      category: 'transparency',
      severity: 'low',
      rule_id: 'trans.no_confidence',
      reason: 'Recommendation does not carry a confidence score.',
      principle: 'transparency',
    });
  }
  if (!s.tradeoffs || s.tradeoffs.length === 0) {
    out.push({
      category: 'transparency',
      severity: 'low',
      rule_id: 'trans.no_tradeoffs',
      reason: 'Recommendation does not surface tradeoffs.',
      principle: 'transparency',
    });
  }
  if (!s.risks || s.risks.length === 0) {
    out.push({
      category: 'transparency',
      severity: 'low',
      rule_id: 'trans.no_risks',
      reason: 'Recommendation does not surface risks.',
      principle: 'transparency',
    });
  }
  return out;
}

export const __test = { TRANSPARENCY_REQUIRED_KINDS, validateTransparency };
