/**
 * Access Review framework — Sprint R Phase 2.
 *
 * Schedules quarterly access reviews for privileged scopes:
 *
 *   platform_admin       — anyone with operator_dashboard.read
 *   tenant_owner         — Sprint P platform.tenant_users role='owner'
 *   service_role         — Supabase service-role keys (a single secret)
 *   db_admin             — anyone who can run DDL
 *   security_team        — incident-response readers
 *
 * Reviews are scheduled per (review_period, scope) pair. Status flips
 * to `overdue` automatically when `scheduled_for < today` and the
 * review hasn't started.
 */

import type { AccessReview } from './types';

export const REQUIRED_SCOPES = Object.freeze([
  'platform_admin',
  'tenant_owner',
  'service_role',
  'db_admin',
  'security_team',
]);

/** Quarter labels for the next year, used by the scheduler. */
export function nextFourQuarters(now = new Date()): string[] {
  const out: string[] = [];
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0..11
  const quarter = Math.floor(month / 3) + 1;
  for (let i = 0; i < 4; i++) {
    const q = ((quarter - 1 + i) % 4) + 1;
    const y = year + Math.floor((quarter - 1 + i) / 4);
    out.push(`${y}-Q${q}`);
  }
  return out;
}

export function computeStatus(review: AccessReview, now = new Date()): AccessReview['status'] {
  if (review.status === 'completed') return 'completed';
  const today = now.toISOString().slice(0, 10);
  if (review.scheduled_for < today && review.status !== 'in_progress') return 'overdue';
  return review.status;
}

export interface CoverageReport {
  required_scopes: string[];
  scopes_with_open_review: string[];
  scopes_missing_review: string[];
  overdue_reviews: AccessReview[];
}

export function coverageReport(reviews: AccessReview[], now = new Date()): CoverageReport {
  const period = currentPeriod(now);
  const open = reviews.filter((r) => r.review_period === period);
  const open_scopes = new Set(open.map((r) => r.scope));
  const missing = REQUIRED_SCOPES.filter((s) => !open_scopes.has(s));
  const overdue = reviews
    .map((r) => ({ ...r, status: computeStatus(r, now) }))
    .filter((r) => r.status === 'overdue');
  return {
    required_scopes: [...REQUIRED_SCOPES],
    scopes_with_open_review: [...open_scopes],
    scopes_missing_review: missing,
    overdue_reviews: overdue,
  };
}

function currentPeriod(now: Date): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const quarter = Math.floor(month / 3) + 1;
  return `${year}-Q${quarter}`;
}

export const __test = { currentPeriod };
