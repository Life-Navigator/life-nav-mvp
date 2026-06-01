/**
 * Partner Bias validator (Principle 7 — No Partner Bias).
 *
 * Detects payloads where the metadata signals that partner economics
 * influenced the recommendation. The validator looks for known
 * metadata keys (commission, kickback, sponsored, paid_placement,
 * affiliate, partner_payout, exclusive_partner) and flags any
 * non-zero presence.
 *
 * Source-of-truth: the metadata. Validators cannot read partner
 * agreements; the system depends on the emitter to honestly tag
 * commercial relationships and on this layer to reject anything
 * that smells like ranking-by-payment.
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

const PARTNER_KEYS = [
  'commission',
  'commission_pct',
  'kickback',
  'sponsored',
  'paid_placement',
  'affiliate',
  'affiliate_id',
  'partner_payout',
  'partner_payout_usd',
  'exclusive_partner',
];

const RANKING_INFLUENCE_KEYS = [
  'ranking_boost',
  'rank_boost',
  'override_rank',
  'promoted_above',
  'ad_priority',
];

export function validatePartnerBias(s: GovernanceSubject): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const meta = s.metadata ?? {};

  // Any partner-revenue key present + any ranking-influence key present
  // is the worst case: payment is influencing ranking.
  const hasPartnerKey = PARTNER_KEYS.some(
    (k) => meta[k] != null && meta[k] !== false && meta[k] !== 0
  );
  const hasRankingInfluence = RANKING_INFLUENCE_KEYS.some(
    (k) => meta[k] != null && meta[k] !== false && meta[k] !== 0
  );

  if (hasPartnerKey && hasRankingInfluence) {
    out.push({
      category: 'partner_bias',
      severity: 'critical',
      rule_id: 'pb.ranking_by_payment',
      reason: 'Recommendation metadata combines partner economics with a ranking-influence signal.',
      principle: 'no_partner_bias',
    });
  } else if (hasPartnerKey) {
    out.push({
      category: 'partner_bias',
      severity: 'high',
      rule_id: 'pb.partner_economics_present',
      reason:
        'Recommendation metadata indicates partner economics that may bias the recommendation.',
      principle: 'no_partner_bias',
    });
  } else if (hasRankingInfluence) {
    out.push({
      category: 'partner_bias',
      severity: 'medium',
      rule_id: 'pb.ranking_override',
      reason: 'Ranking-influence metadata is present without a stated partner relationship.',
      principle: 'no_partner_bias',
    });
  }
  return out;
}

export const __test = {
  PARTNER_KEYS,
  RANKING_INFLUENCE_KEYS,
  validatePartnerBias,
};
