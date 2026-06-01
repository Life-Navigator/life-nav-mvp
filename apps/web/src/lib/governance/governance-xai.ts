/**
 * Governance XAI — Sprint L Phase 9.
 *
 * When a recommendation is blocked, the user must be able to ask
 * "why was this blocked?" and receive a plain-language explanation
 * that exposes:
 *
 *   - policy category
 *   - rule explanation
 *   - safer alternatives
 *
 * The XAI surface does NOT expose internal regex patterns, validator
 * implementations, or governance version diffs.
 *
 * Deterministic.
 */

import { composeBlockMessage, safetyMessageFor } from './safety-messaging';
import type {
  GovernanceDecision,
  GovernanceViolation,
  SaferAlternative,
  ViolationCategory,
} from '@/types/governance';
import { PRINCIPLES } from '@/types/governance';

export interface GovernanceExplanation {
  blocked: boolean;
  verdict: 'approved' | 'approved_with_warnings' | 'blocked';
  worst_category?: ViolationCategory;
  worst_principle?: string;
  short_summary: string;
  detailed_reasons: Array<{
    category: ViolationCategory;
    principle: string;
    severity: GovernanceViolation['severity'];
    reason: string;
  }>;
  safer_alternatives: SaferAlternative[];
  governance_version: string;
}

function principleName(id: string): string {
  const p = PRINCIPLES.find((x) => x.id === id);
  return p?.name ?? id;
}

export function explainDecision(decision: GovernanceDecision): GovernanceExplanation {
  if (decision.verdict === 'approved') {
    return {
      blocked: false,
      verdict: 'approved',
      short_summary: 'This recommendation passed all governance checks.',
      detailed_reasons: [],
      safer_alternatives: [],
      governance_version: decision.governance_version,
    };
  }
  if (decision.verdict === 'approved_with_warnings') {
    return {
      blocked: false,
      verdict: 'approved_with_warnings',
      worst_category: decision.violations[0]?.category,
      worst_principle: decision.violations[0]
        ? principleName(decision.violations[0].principle)
        : undefined,
      short_summary:
        'This recommendation was approved but did not fully meet our transparency or framing standards. ' +
        'The annotations below explain what was missing.',
      detailed_reasons: decision.violations.map((v) => ({
        category: v.category,
        principle: principleName(v.principle),
        severity: v.severity,
        reason: v.reason,
      })),
      safer_alternatives: decision.safer_alternatives,
      governance_version: decision.governance_version,
    };
  }
  // Blocked
  const msg = composeBlockMessage(decision.violations);
  return {
    blocked: true,
    verdict: 'blocked',
    worst_category: decision.violations[0]?.category,
    worst_principle: decision.violations[0]
      ? principleName(decision.violations[0].principle)
      : undefined,
    short_summary: msg.message,
    detailed_reasons: decision.violations.map((v) => ({
      category: v.category,
      principle: principleName(v.principle),
      severity: v.severity,
      reason: v.reason,
    })),
    safer_alternatives: msg.safer_alternatives,
    governance_version: decision.governance_version,
  };
}

export const __test = { explainDecision, principleName, safetyMessageFor };
