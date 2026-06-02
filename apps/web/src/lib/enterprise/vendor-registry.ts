/**
 * Vendor Registry — Sprint R Phase 3.
 *
 * The seven named vendors carry critical compliance metadata. This
 * module is the application-side source-of-truth for what counts as
 * production vendor and whether they're in good standing. The DB
 * carries authoritative state; this module exposes helpers for the
 * dashboard + the SOC 2 evidence collection script.
 */

import type { Vendor, RiskTier } from './types';

/** The 7 named vendors per the Sprint R spec. */
export const NAMED_VENDORS: ReadonlyArray<string> = Object.freeze([
  'gemini',
  'supabase',
  'flyio',
  'neo4j',
  'qdrant',
  'plaid',
  'vercel',
]);

export interface VendorRollup {
  total: number;
  by_tier: Record<RiskTier, number>;
  pending_review: number;
  reviews_overdue: number;
  dpa_signed_pct: number;
  named_vendors_present: number;
}

export function rollupVendors(vendors: Vendor[]): VendorRollup {
  const by_tier: Record<RiskTier, number> = { high: 0, medium: 0, low: 0 };
  let pending = 0;
  let overdue = 0;
  let dpa = 0;
  const today = new Date().toISOString().slice(0, 10);
  const present = new Set<string>();

  for (const v of vendors) {
    by_tier[v.risk_tier] = (by_tier[v.risk_tier] ?? 0) + 1;
    if (v.status === 'pending_review') pending += 1;
    if (v.next_review_due && v.next_review_due < today && v.status === 'active') overdue += 1;
    if (v.dpa_signed) dpa += 1;
    if (NAMED_VENDORS.includes(v.vendor_key)) present.add(v.vendor_key);
  }

  return {
    total: vendors.length,
    by_tier,
    pending_review: pending,
    reviews_overdue: overdue,
    dpa_signed_pct: vendors.length === 0 ? 0 : round3(dpa / vendors.length),
    named_vendors_present: present.size,
  };
}

/**
 * Surface vendors that need a review in the next `days` (default 30).
 * Used by the operational dashboard.
 */
export function vendorsDueForReview(vendors: Vendor[], within_days = 30): Vendor[] {
  const horizon = new Date(Date.now() + within_days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return vendors.filter(
    (v) => v.status === 'active' && !!v.next_review_due && v.next_review_due <= horizon
  );
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export const __test = { NAMED_VENDORS };
