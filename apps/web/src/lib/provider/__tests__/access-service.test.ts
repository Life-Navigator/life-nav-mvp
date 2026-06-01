/**
 * @jest-environment node
 *
 * ProviderAccessService — the gatekeeper test suite. Verifies that
 * verifyAccess correctly returns AccessDecision for every denial
 * path and only `allowed: true` when ALL barriers are cleared.
 */

import { __test } from '../access-service';
import type { ProviderEngagement, ProviderProfile } from '@/types/provider';

const { verifyAccess } = __test;

function profile(
  over: Partial<ProviderProfile> = {}
): Pick<ProviderProfile, 'id' | 'user_id' | 'verified'> {
  return { id: 'prov_1', user_id: 'user_provider', verified: true, ...over };
}

function engagement(
  over: Partial<ProviderEngagement> = {}
): Pick<
  ProviderEngagement,
  'status' | 'allowed_domains' | 'max_sensitivity' | 'accepted_at' | 'revoked_at' | 'expires_at'
> {
  return {
    status: 'active',
    allowed_domains: ['health'],
    max_sensitivity: 'medium',
    accepted_at: '2026-01-01T00:00:00Z',
    revoked_at: null,
    expires_at: null,
    ...over,
  };
}

describe('verifyAccess — happy path', () => {
  test('verified provider + active engagement + in-scope domain + within-max sensitivity → allowed', () => {
    const d = verifyAccess({
      provider: profile(),
      engagement: engagement(),
      requested_domain: 'health',
      requested_sensitivity: 'low',
    });
    expect(d.allowed).toBe(true);
    expect(d.reasons).toEqual([]);
  });

  test('max_sensitivity=medium allows medium request', () => {
    const d = verifyAccess({
      provider: profile(),
      engagement: engagement({ max_sensitivity: 'medium' }),
      requested_domain: 'health',
      requested_sensitivity: 'medium',
    });
    expect(d.allowed).toBe(true);
  });

  test('max_sensitivity=high allows low/medium/high', () => {
    for (const req of ['low', 'medium', 'high'] as const) {
      const d = verifyAccess({
        provider: profile(),
        engagement: engagement({ max_sensitivity: 'high' }),
        requested_domain: 'health',
        requested_sensitivity: req,
      });
      expect(d.allowed).toBe(true);
    }
  });
});

describe('verifyAccess — denial paths', () => {
  test('no provider record → provider_not_verified', () => {
    const d = verifyAccess({
      provider: null,
      engagement: engagement(),
      requested_domain: 'health',
      requested_sensitivity: 'low',
    });
    expect(d.allowed).toBe(false);
    expect(d.reasons).toContain('provider_not_verified');
  });

  test('unverified provider → provider_not_verified', () => {
    const d = verifyAccess({
      provider: profile({ verified: false }),
      engagement: engagement(),
      requested_domain: 'health',
      requested_sensitivity: 'low',
    });
    expect(d.reasons).toContain('provider_not_verified');
  });

  test('no engagement → engagement_missing', () => {
    const d = verifyAccess({
      provider: profile(),
      engagement: null,
      requested_domain: 'health',
      requested_sensitivity: 'low',
    });
    expect(d.reasons).toContain('engagement_missing');
  });

  test('engagement not active → engagement_not_active', () => {
    const d = verifyAccess({
      provider: profile(),
      engagement: engagement({ status: 'paused' }),
      requested_domain: 'health',
      requested_sensitivity: 'low',
    });
    expect(d.allowed).toBe(false);
    expect(d.reasons).toContain('engagement_not_active');
  });

  test('engagement not accepted → engagement_not_accepted', () => {
    const d = verifyAccess({
      provider: profile(),
      engagement: engagement({ accepted_at: null }),
      requested_domain: 'health',
      requested_sensitivity: 'low',
    });
    expect(d.reasons).toContain('engagement_not_accepted');
  });

  test('engagement revoked → engagement_revoked', () => {
    const d = verifyAccess({
      provider: profile(),
      engagement: engagement({ revoked_at: '2026-01-15T00:00:00Z' }),
      requested_domain: 'health',
      requested_sensitivity: 'low',
    });
    expect(d.reasons).toContain('engagement_revoked');
  });

  test('engagement expired → engagement_expired', () => {
    const d = verifyAccess({
      provider: profile(),
      engagement: engagement({ expires_at: '2024-01-01T00:00:00Z' }),
      requested_domain: 'health',
      requested_sensitivity: 'low',
      now: '2026-05-31T00:00:00Z',
    });
    expect(d.reasons).toContain('engagement_expired');
  });

  test('domain out of scope → domain_out_of_scope', () => {
    const d = verifyAccess({
      provider: profile(),
      engagement: engagement({ allowed_domains: ['health'] }),
      requested_domain: 'financial',
      requested_sensitivity: 'low',
    });
    expect(d.allowed).toBe(false);
    expect(d.reasons).toContain('domain_out_of_scope');
  });

  test('sensitivity exceeds max → sensitivity_exceeds_max', () => {
    const d = verifyAccess({
      provider: profile(),
      engagement: engagement({ max_sensitivity: 'low' }),
      requested_domain: 'health',
      requested_sensitivity: 'high',
    });
    expect(d.reasons).toContain('sensitivity_exceeds_max');
  });
});

describe('cross-patient leakage protection', () => {
  test('provider with valid engagement to patient A is DENIED for patient B (no engagement)', () => {
    // The provider has an engagement with patient A. They try to access
    // patient B for whom they have no engagement. The pure verifier
    // can prove this by being called with `engagement: null` (the
    // loader returned nothing for patient B).
    const d = verifyAccess({
      provider: profile(), // verified
      engagement: null, // no engagement to patient B
      requested_domain: 'health',
      requested_sensitivity: 'low',
    });
    expect(d.allowed).toBe(false);
    expect(d.reasons).toContain('engagement_missing');
  });

  test('expired engagement on patient A does NOT leak data', () => {
    const d = verifyAccess({
      provider: profile(),
      engagement: engagement({ expires_at: '2024-01-01T00:00:00Z' }),
      requested_domain: 'health',
      requested_sensitivity: 'low',
      now: '2026-06-01T00:00:00Z',
    });
    expect(d.allowed).toBe(false);
  });

  test('revoked engagement on patient A does NOT leak data even if other fields are valid', () => {
    const d = verifyAccess({
      provider: profile(),
      engagement: engagement({ revoked_at: '2026-05-30T00:00:00Z' }),
      requested_domain: 'health',
      requested_sensitivity: 'low',
    });
    expect(d.allowed).toBe(false);
    expect(d.reasons).toContain('engagement_revoked');
  });

  test('domain out of scope blocks access even with active engagement', () => {
    // Provider has health-only engagement, tries to access financial.
    const d = verifyAccess({
      provider: profile(),
      engagement: engagement({ allowed_domains: ['health'] }),
      requested_domain: 'financial',
      requested_sensitivity: 'low',
    });
    expect(d.allowed).toBe(false);
  });
});

describe('multiple denial reasons accumulate', () => {
  test('revoked + out-of-scope + too-sensitive → all three reasons surfaced', () => {
    const d = verifyAccess({
      provider: profile(),
      engagement: engagement({
        revoked_at: '2026-05-30T00:00:00Z',
        allowed_domains: ['health'],
        max_sensitivity: 'low',
      }),
      requested_domain: 'financial',
      requested_sensitivity: 'high',
    });
    expect(d.allowed).toBe(false);
    expect(d.reasons).toEqual(
      expect.arrayContaining([
        'engagement_revoked',
        'domain_out_of_scope',
        'sensitivity_exceeds_max',
      ])
    );
  });
});
