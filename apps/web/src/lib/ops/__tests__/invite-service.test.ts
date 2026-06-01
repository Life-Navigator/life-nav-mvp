/**
 * @jest-environment node
 *
 * Invite service tests.
 */

import { __test } from '../invite-service';

const { evaluateInvite, generateInviteCode } = __test;

function invite(
  over: Partial<
    Parameters<typeof evaluateInvite>[0] extends infer T ? Exclude<T, null> : never
  > = {}
) {
  return {
    id: 'i1',
    email: 'a@b.com',
    invite_code: 'AAAA-BBBB-CCCC',
    cohort_slug: 'default',
    invited_at: '2026-05-01T00:00:00Z',
    expires_at: '2027-01-01T00:00:00Z',
    status: 'pending' as const,
    ...over,
  };
}

describe('evaluateInvite', () => {
  test('null → invite_not_found', () => {
    expect(evaluateInvite(null, '2026-06-01T00:00:00Z')).toEqual({
      ok: false,
      reasons: ['invite_not_found'],
    });
  });
  test('valid pending invite passes', () => {
    expect(evaluateInvite(invite(), '2026-06-01T00:00:00Z').ok).toBe(true);
  });
  test('expired rejected', () => {
    const r = evaluateInvite(
      invite({ expires_at: '2026-01-01T00:00:00Z' }),
      '2026-06-01T00:00:00Z'
    );
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('invite_expired');
  });
  test('revoked rejected', () => {
    const r = evaluateInvite(
      invite({ revoked_at: '2026-05-15T00:00:00Z', status: 'revoked' }),
      '2026-06-01T00:00:00Z'
    );
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('invite_revoked');
  });
  test('already accepted rejected', () => {
    const r = evaluateInvite(
      invite({ status: 'accepted', accepted_by: 'u1' }),
      '2026-06-01T00:00:00Z'
    );
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('invite_already_accepted');
  });
});

describe('generateInviteCode', () => {
  test('shape: AAAA-BBBB-CCCC (12 chars + 2 hyphens, no ambiguous chars)', () => {
    // deterministic by passing a fixed rand
    let n = 0;
    const code = generateInviteCode(() => {
      // Pre-computed sequence: 0,1/31,2/31,... — just need ≥12 distinct values.
      n++;
      return (n * 0.123) % 1;
    });
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(code).not.toMatch(/[01ILO]/);
  });
});
