/**
 * ConflictOfInterestEngine (Phase 7).
 *
 * Detects:
 *   - Partner revenue bias
 *   - Provider revenue bias
 *   - Referral bias
 *   - Sponsorship bias
 *   - Affiliate bias
 *
 * Flags recommendations that appear influenced by revenue generation.
 *
 * Distinct from `partner-bias.ts`: that validator looks at a single
 * subject's metadata. The COI engine ALSO considers the emitter's
 * financial relationship to the recommended outcome (provider
 * recommending a service they are the in-network endpoint for, etc.).
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

const REFERRAL_BIAS_KEYS = ['referral_fee', 'referral_payout', 'referral_to'];
const SPONSORSHIP_KEYS = ['sponsor', 'sponsored_by', 'sponsorship_value_usd'];
const AFFILIATE_KEYS = ['affiliate_link', 'affiliate_id', 'affiliate_program'];
const PROVIDER_SELF_DEALING_FLAGS = [
  'recommends_own_service',
  'provider_owned_facility',
  'in_network_with_emitter',
  'provider_is_beneficiary',
];

function present(meta: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((k) => meta[k] != null && meta[k] !== false && meta[k] !== 0);
}

export interface COIResult {
  violations: GovernanceViolation[];
  highest_severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export function detectConflictsOfInterest(s: GovernanceSubject): COIResult {
  const v: GovernanceViolation[] = [];
  const meta = (s.metadata ?? {}) as Record<string, unknown>;

  if (present(meta, REFERRAL_BIAS_KEYS)) {
    v.push({
      category: 'conflict_of_interest',
      severity: 'high',
      rule_id: 'coi.referral_fee',
      reason: 'Subject carries a referral-fee signal.',
      principle: 'no_partner_bias',
    });
  }
  if (present(meta, SPONSORSHIP_KEYS)) {
    v.push({
      category: 'conflict_of_interest',
      severity: 'high',
      rule_id: 'coi.sponsorship',
      reason: 'Subject is sponsored.',
      principle: 'no_partner_bias',
    });
  }
  if (present(meta, AFFILIATE_KEYS)) {
    v.push({
      category: 'conflict_of_interest',
      severity: 'high',
      rule_id: 'coi.affiliate',
      reason: 'Subject contains affiliate-program metadata.',
      principle: 'no_partner_bias',
    });
  }
  // Provider self-dealing flags are the most serious: the emitter has
  // a direct financial interest in the recommendation succeeding.
  for (const flag of PROVIDER_SELF_DEALING_FLAGS) {
    if (meta[flag] === true) {
      v.push({
        category: 'conflict_of_interest',
        severity: 'critical',
        rule_id: `coi.provider_self_dealing.${flag}`,
        reason: 'Emitter has a direct financial interest in the recommended outcome.',
        principle: 'no_partner_bias',
      });
    }
  }

  const order = { none: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;
  let top: COIResult['highest_severity'] = 'none';
  for (const x of v) if (order[x.severity] > order[top]) top = x.severity;
  return { violations: v, highest_severity: top };
}

export const __test = {
  detectConflictsOfInterest,
  REFERRAL_BIAS_KEYS,
  SPONSORSHIP_KEYS,
  AFFILIATE_KEYS,
  PROVIDER_SELF_DEALING_FLAGS,
};
