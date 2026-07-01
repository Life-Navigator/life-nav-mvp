/** @jest-environment node */
import { inviteKeyFor, verifyInviteKey, inviteGateConfigured } from '../inviteKey';

const ENV = process.env;
beforeEach(() => {
  process.env = { ...ENV, INVITE_SIGNING_SECRET: 'test-secret-at-least-16-chars-long' };
});
afterAll(() => {
  process.env = ENV;
});

describe('private invite key', () => {
  it('mints + verifies an email-bound key', () => {
    const key = inviteKeyFor('tester@example.com');
    expect(typeof key).toBe('string');
    expect(verifyInviteKey('tester@example.com', key)).toBe(true);
    expect(verifyInviteKey('TESTER@example.com', key)).toBe(true); // case-insensitive
  });

  it('a key for one email does NOT work for another (email-bound)', () => {
    const key = inviteKeyFor('alice@example.com');
    expect(verifyInviteKey('bob@example.com', key)).toBe(false);
  });

  it('rejects a missing/garbage key', () => {
    expect(verifyInviteKey('tester@example.com', '')).toBe(false);
    expect(verifyInviteKey('tester@example.com', 'not-the-real-key')).toBe(false);
    expect(verifyInviteKey('', inviteKeyFor('tester@example.com'))).toBe(false);
  });

  it('a different secret produces a non-matching key (only the founder can mint)', () => {
    const key = inviteKeyFor('tester@example.com');
    process.env.INVITE_SIGNING_SECRET = 'a-totally-different-secret-key!!';
    expect(verifyInviteKey('tester@example.com', key)).toBe(false);
  });

  it('fails closed when the secret is unset', () => {
    delete process.env.INVITE_SIGNING_SECRET;
    expect(inviteGateConfigured()).toBe(false);
    expect(verifyInviteKey('tester@example.com', 'anything')).toBe(false);
  });
});
