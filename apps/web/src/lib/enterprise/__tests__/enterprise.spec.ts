/**
 * @jest-environment node
 *
 * Sprint R — enterprise readiness tests.
 */

import {
  NAMED_VENDORS,
  rollupVendors,
  vendorsDueForReview,
  daysUntilDue,
  ageDays,
  partitionByDueness,
  DUE_SOON_WINDOW_DAYS,
  REQUIRED_SCOPES,
  nextFourQuarters,
  computeStatus,
  coverageReport,
} from '..';
import type { Vendor, SecretRotationItem, AccessReview } from '..';

const DAY = 24 * 60 * 60 * 1000;
const iso = (offset_days: number) =>
  new Date(Date.now() + offset_days * DAY).toISOString().slice(0, 10);

function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    vendor_key: 'acme',
    display_name: 'Acme',
    risk_tier: 'medium',
    subprocessors: [],
    certifications: ['SOC 2'],
    dpa_signed: true,
    baa_signed: false,
    last_reviewed_at: iso(-30),
    next_review_due: iso(335),
    status: 'active',
    ...overrides,
  };
}

// ===========================================================================
// Vendor registry
// ===========================================================================

describe('NAMED_VENDORS', () => {
  test('contains the 7 Sprint R vendors', () => {
    expect(NAMED_VENDORS).toEqual([
      'gemini',
      'supabase',
      'flyio',
      'neo4j',
      'qdrant',
      'plaid',
      'vercel',
    ]);
  });
});

describe('rollupVendors', () => {
  test('counts by tier + DPA + named vendors present', () => {
    const v: Vendor[] = [
      makeVendor({ vendor_key: 'gemini', risk_tier: 'high', dpa_signed: true }),
      makeVendor({ vendor_key: 'supabase', risk_tier: 'high', dpa_signed: true }),
      makeVendor({ vendor_key: 'flyio', risk_tier: 'medium', dpa_signed: false }),
      makeVendor({ vendor_key: 'acme', risk_tier: 'low', dpa_signed: true }),
    ];
    const r = rollupVendors(v);
    expect(r.total).toBe(4);
    expect(r.by_tier.high).toBe(2);
    expect(r.by_tier.medium).toBe(1);
    expect(r.by_tier.low).toBe(1);
    expect(r.dpa_signed_pct).toBe(0.75);
    expect(r.named_vendors_present).toBe(3); // gemini, supabase, flyio
  });

  test('overdue review counter fires for past next_review_due', () => {
    const r = rollupVendors([
      makeVendor({ vendor_key: 'gemini', next_review_due: iso(-5) }),
      makeVendor({ vendor_key: 'supabase', next_review_due: iso(180) }),
    ]);
    expect(r.reviews_overdue).toBe(1);
  });

  test('pending_review count fires on status=pending_review', () => {
    const r = rollupVendors([
      makeVendor({ status: 'pending_review' }),
      makeVendor({ status: 'active' }),
    ]);
    expect(r.pending_review).toBe(1);
  });
});

describe('vendorsDueForReview', () => {
  test('includes vendors with next_review_due within the horizon', () => {
    const within = makeVendor({ vendor_key: 'within', next_review_due: iso(15) });
    const outside = makeVendor({ vendor_key: 'outside', next_review_due: iso(180) });
    const due = vendorsDueForReview([within, outside], 30);
    expect(due.map((v) => v.vendor_key)).toEqual(['within']);
  });

  test('only active vendors are returned', () => {
    const due = vendorsDueForReview(
      [
        makeVendor({ vendor_key: 'a', status: 'deprecated', next_review_due: iso(10) }),
        makeVendor({ vendor_key: 'b', status: 'active', next_review_due: iso(10) }),
      ],
      30
    );
    expect(due.map((v) => v.vendor_key)).toEqual(['b']);
  });
});

// ===========================================================================
// Secret rotation
// ===========================================================================

function makeSecret(overrides: Partial<SecretRotationItem> = {}): SecretRotationItem {
  return {
    secret_key: 'API_KEY',
    owner_team: 'platform',
    rotation_period_days: 90,
    last_rotated_at: new Date(Date.now() - 30 * DAY).toISOString(),
    next_due_at: new Date(Date.now() + 60 * DAY).toISOString(),
    storage_location: 'gsm:test/api-key',
    rotation_method: 'manual',
    ...overrides,
  };
}

describe('daysUntilDue + ageDays', () => {
  test('daysUntilDue returns positive for future due dates', () => {
    expect(
      daysUntilDue(makeSecret({ next_due_at: new Date(Date.now() + 10 * DAY).toISOString() }))
    ).toBe(10);
  });

  test('daysUntilDue returns negative for past due dates', () => {
    expect(
      daysUntilDue(makeSecret({ next_due_at: new Date(Date.now() - 5 * DAY).toISOString() }))
    ).toBe(-5);
  });

  test('daysUntilDue returns null when next_due_at is missing', () => {
    expect(daysUntilDue(makeSecret({ next_due_at: undefined }))).toBeNull();
  });

  test('ageDays counts time since last_rotated_at', () => {
    expect(
      ageDays(makeSecret({ last_rotated_at: new Date(Date.now() - 45 * DAY).toISOString() }))
    ).toBe(45);
  });
});

describe('partitionByDueness', () => {
  test('overdue / due_soon / ok partition is correct', () => {
    const items: SecretRotationItem[] = [
      makeSecret({ secret_key: 'A', next_due_at: new Date(Date.now() - 1 * DAY).toISOString() }),
      makeSecret({ secret_key: 'B', next_due_at: new Date(Date.now() + 7 * DAY).toISOString() }),
      makeSecret({ secret_key: 'C', next_due_at: new Date(Date.now() + 60 * DAY).toISOString() }),
    ];
    const r = partitionByDueness(items);
    expect(r.overdue.map((s) => s.secret_key)).toEqual(['A']);
    expect(r.due_soon.map((s) => s.secret_key)).toEqual(['B']);
    expect(r.ok.map((s) => s.secret_key)).toEqual(['C']);
  });

  test('secrets without next_due_at are reported as overdue', () => {
    const r = partitionByDueness([makeSecret({ next_due_at: undefined })]);
    expect(r.overdue.length).toBe(1);
  });

  test('oldest_age_days surfaces the longest stale secret', () => {
    const r = partitionByDueness([
      makeSecret({ last_rotated_at: new Date(Date.now() - 10 * DAY).toISOString() }),
      makeSecret({ last_rotated_at: new Date(Date.now() - 100 * DAY).toISOString() }),
    ]);
    expect(r.oldest_age_days).toBe(100);
  });

  test('DUE_SOON_WINDOW_DAYS exposed and reasonable', () => {
    expect(DUE_SOON_WINDOW_DAYS).toBeGreaterThan(7);
    expect(DUE_SOON_WINDOW_DAYS).toBeLessThanOrEqual(30);
  });
});

// ===========================================================================
// Access review
// ===========================================================================

describe('REQUIRED_SCOPES', () => {
  test('covers the privileged scopes named by the spec', () => {
    expect(REQUIRED_SCOPES).toContain('platform_admin');
    expect(REQUIRED_SCOPES).toContain('tenant_owner');
    expect(REQUIRED_SCOPES).toContain('service_role');
    expect(REQUIRED_SCOPES).toContain('db_admin');
    expect(REQUIRED_SCOPES).toContain('security_team');
  });
});

describe('nextFourQuarters', () => {
  test('returns 4 unique quarter labels', () => {
    const r = nextFourQuarters();
    expect(r.length).toBe(4);
    expect(new Set(r).size).toBe(4);
    expect(r[0]).toMatch(/^\d{4}-Q[1-4]$/);
  });
});

describe('computeStatus', () => {
  test('past-due review with status=scheduled flips to overdue', () => {
    const r: AccessReview = {
      review_period: '2025-Q1',
      scope: 'platform_admin',
      status: 'scheduled',
      scheduled_for: '2025-01-15',
      subjects_total: 0,
      subjects_revoked: 0,
      subjects_modified: 0,
    };
    expect(computeStatus(r, new Date('2025-04-01T00:00:00.000Z'))).toBe('overdue');
  });

  test('past-due review with status=in_progress is preserved', () => {
    const r: AccessReview = {
      review_period: '2025-Q1',
      scope: 'platform_admin',
      status: 'in_progress',
      scheduled_for: '2025-01-15',
      subjects_total: 0,
      subjects_revoked: 0,
      subjects_modified: 0,
    };
    expect(computeStatus(r, new Date('2025-04-01T00:00:00.000Z'))).toBe('in_progress');
  });

  test('completed review stays completed', () => {
    const r: AccessReview = {
      review_period: '2025-Q1',
      scope: 'platform_admin',
      status: 'completed',
      scheduled_for: '2025-01-15',
      completed_at: '2025-02-01T00:00:00.000Z',
      subjects_total: 5,
      subjects_revoked: 1,
      subjects_modified: 1,
    };
    expect(computeStatus(r, new Date('2025-04-01T00:00:00.000Z'))).toBe('completed');
  });
});

describe('coverageReport', () => {
  test('flags scopes with no current-period review as missing', () => {
    const now = new Date('2026-05-01T00:00:00.000Z');
    const reviews: AccessReview[] = [
      {
        review_period: '2026-Q2',
        scope: 'platform_admin',
        status: 'in_progress',
        scheduled_for: '2026-04-15',
        subjects_total: 5,
        subjects_revoked: 0,
        subjects_modified: 0,
      },
    ];
    const r = coverageReport(reviews, now);
    expect(r.scopes_with_open_review).toEqual(['platform_admin']);
    expect(r.scopes_missing_review).toEqual(
      expect.arrayContaining(['tenant_owner', 'service_role', 'db_admin', 'security_team'])
    );
  });

  test('returns overdue reviews', () => {
    const now = new Date('2026-05-01T00:00:00.000Z');
    const reviews: AccessReview[] = [
      {
        review_period: '2025-Q4',
        scope: 'db_admin',
        status: 'scheduled',
        scheduled_for: '2025-12-15',
        subjects_total: 0,
        subjects_revoked: 0,
        subjects_modified: 0,
      },
    ];
    const r = coverageReport(reviews, now);
    expect(r.overdue_reviews.length).toBe(1);
    expect(r.overdue_reviews[0].scope).toBe('db_admin');
  });
});
