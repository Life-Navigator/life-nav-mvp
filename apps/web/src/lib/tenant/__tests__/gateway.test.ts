/**
 * @jest-environment node
 *
 * API gateway + key generation tests.
 */

import { __test as keysTest } from '../api-keys';
import { __test as gwTest } from '../api-gateway';

const { generateKey, sha256Hex, isValidKeyShape } = keysTest;
const { checkRateLimit, resolveApiKey, readKey } = gwTest;

describe('generateKey', () => {
  test('emits a key with the documented shape', () => {
    const k = generateKey('test');
    expect(k.plain).toMatch(/^lnk_test_[A-Za-z2-9]{32}$/);
    expect(k.prefix).toHaveLength(12);
    expect(k.key_hash).toHaveLength(64);
  });
  test('plain key hashes to key_hash', () => {
    const k = generateKey('live');
    expect(sha256Hex(k.plain)).toBe(k.key_hash);
  });
  test('isValidKeyShape', () => {
    expect(isValidKeyShape('lnk_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true);
    expect(isValidKeyShape('not-a-key')).toBe(false);
    expect(isValidKeyShape('lnk_live_short')).toBe(false);
  });
});

describe('checkRateLimit', () => {
  test('allows up to max_per_minute calls then rejects', () => {
    const t = `tenant_${Math.random()}`;
    let allowed = 0;
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(t, 3);
      if (r.ok) allowed++;
    }
    expect(allowed).toBe(3);
  });
  test('different tenants have independent buckets', () => {
    const a = `tA_${Math.random()}`;
    const b = `tB_${Math.random()}`;
    expect(checkRateLimit(a, 2).ok).toBe(true);
    expect(checkRateLimit(a, 2).ok).toBe(true);
    expect(checkRateLimit(a, 2).ok).toBe(false);
    expect(checkRateLimit(b, 2).ok).toBe(true);
  });
});

describe('readKey', () => {
  test('reads Authorization: Bearer header', () => {
    const r = new Request('http://x', { headers: { authorization: 'Bearer lnk_live_abc' } });
    expect(readKey(r)).toBe('lnk_live_abc');
  });
  test('reads x-api-key header', () => {
    const r = new Request('http://x', { headers: { 'x-api-key': 'lnk_test_xyz' } });
    expect(readKey(r)).toBe('lnk_test_xyz');
  });
  test('returns null when missing', () => {
    expect(readKey(new Request('http://x'))).toBeNull();
  });
});

describe('resolveApiKey', () => {
  function fakeSupabase(row: Record<string, unknown> | null) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: row }) }),
        }),
      }),
    };
  }

  test('missing header → 401', async () => {
    const r = await resolveApiKey(fakeSupabase(null), new Request('http://x'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('missing_api_key');
  });

  test('bad shape → 401', async () => {
    const r = await resolveApiKey(
      fakeSupabase(null),
      new Request('http://x', {
        headers: { authorization: 'Bearer not-a-key' },
      })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad_key_shape');
  });

  test('unknown key → 401', async () => {
    const k = generateKey();
    const r = await resolveApiKey(
      fakeSupabase(null),
      new Request('http://x', {
        headers: { authorization: `Bearer ${k.plain}` },
      })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unknown_key');
  });

  test('hash mismatch → 401', async () => {
    const k = generateKey();
    const r = await resolveApiKey(
      fakeSupabase({
        id: 'k',
        tenant_id: 't1',
        status: 'active',
        expires_at: null,
        scopes: [],
        key_hash: 'wrong_hash',
      }),
      new Request('http://x', { headers: { authorization: `Bearer ${k.plain}` } })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unknown_key');
  });

  test('active key → ok', async () => {
    const k = generateKey();
    const r = await resolveApiKey(
      fakeSupabase({
        id: 'k',
        tenant_id: 't1',
        status: 'active',
        expires_at: null,
        scopes: ['read'],
        key_hash: k.key_hash,
      }),
      new Request('http://x', { headers: { authorization: `Bearer ${k.plain}` } })
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tenant_id).toBe('t1');
      expect(r.scopes).toEqual(['read']);
    }
  });

  test('expired key → 401', async () => {
    const k = generateKey();
    const r = await resolveApiKey(
      fakeSupabase({
        id: 'k',
        tenant_id: 't1',
        status: 'active',
        expires_at: '2020-01-01T00:00:00Z',
        scopes: [],
        key_hash: k.key_hash,
      }),
      new Request('http://x', { headers: { authorization: `Bearer ${k.plain}` } })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('expired');
  });
});
