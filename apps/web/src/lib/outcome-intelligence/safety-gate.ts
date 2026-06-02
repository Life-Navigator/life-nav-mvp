/**
 * Safety Gate — Sprint O.
 *
 * The single chokepoint that decides whether an outcome signal can
 * influence optimization. A recommendation is "safety compliant" iff:
 *
 *   1. Governance approved the response.
 *   2. The constitutional verdict is APPROVE or APPROVE_WITH_MODIFICATION.
 *   3. The character review did NOT request regeneration AND did NOT
 *      record a dignity violation.
 *   4. The character trusted-advisor + family-table tests passed.
 *   5. The character review did NOT flag a harm to health, safety, or
 *      financial flourishing.
 *   6. The constitutional risk_level is LOW or MODERATE (never HIGH or
 *      CRITICAL — those imply crisis, where outcome optimization must
 *      defer entirely).
 *
 * Any rec failing any of these is excluded from every score in this
 * module. Optimizers consuming outcome-intelligence outputs are
 * therefore unable to push for unsafe outcomes, even by accident.
 */

import type { RecommendationContext } from './types';

export interface SafetyVerdict {
  is_safety_compliant: boolean;
  reasons: string[];
}

const APPROVE_VERDICTS = new Set(['APPROVE', 'APPROVE_WITH_MODIFICATION']);

export function checkSafety(ctx: RecommendationContext): SafetyVerdict {
  const reasons: string[] = [];

  if (ctx.governance_approved === false) reasons.push('governance_blocked');
  if (
    ctx.constitutional_verdict !== undefined &&
    !APPROVE_VERDICTS.has(ctx.constitutional_verdict)
  ) {
    reasons.push(`constitutional_verdict_${ctx.constitutional_verdict.toLowerCase()}`);
  }
  if (ctx.character_needs_regeneration === true) reasons.push('character_needs_regeneration');
  if (ctx.character_dignity_violation === true) reasons.push('character_dignity_violation');
  if (ctx.character_family_table_passes === false) reasons.push('family_table_failed');
  if (ctx.character_trusted_advisor_passes === false) reasons.push('trusted_advisor_failed');
  if (Array.isArray(ctx.character_flourishing_harming_axes)) {
    for (const a of ctx.character_flourishing_harming_axes) {
      if (a === 'health' || a === 'safety' || a === 'financial') {
        reasons.push(`flourishing_harm_${a}`);
      }
    }
  }
  if (ctx.risk_level === 'HIGH' || ctx.risk_level === 'CRITICAL') {
    reasons.push(`risk_level_${ctx.risk_level.toLowerCase()}`);
  }

  return { is_safety_compliant: reasons.length === 0, reasons };
}

/** Convenience filter — keeps only safety-compliant contexts. */
export function filterSafe<T extends { context: RecommendationContext }>(rows: T[]): T[] {
  return rows.filter((r) => checkSafety(r.context).is_safety_compliant);
}
