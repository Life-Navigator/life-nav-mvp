/**
 * Web release identity (/api/version).
 *
 * Mirrors the core-api contract. The negative tests carry the weight: identity must fail loudly
 * where it is gated, and must never leak infrastructure detail.
 */
import { resolveWebReleaseIdentity } from '../identity';

const SHA = 'b'.repeat(40);

describe('web release identity', () => {
  it('returns the injected identity', () => {
    const r = resolveWebReleaseIdentity({
      NEXT_PUBLIC_LN_COMMIT_SHA: SHA,
      NEXT_PUBLIC_LN_BUILD_TIME: '2026-07-31T12:00:00Z',
      NEXT_PUBLIC_LN_ENVIRONMENT: 'staging',
      NEXT_PUBLIC_LN_APP_VERSION: '6.0.0',
    } as NodeJS.ProcessEnv);

    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      service: 'lifenavigator-web',
      commit_sha: SHA,
      build_time: '2026-07-31T12:00:00Z',
      environment: 'staging',
      version: '6.0.0',
    });
  });

  it('falls back to VERCEL_GIT_COMMIT_SHA when the explicit var is absent', () => {
    const r = resolveWebReleaseIdentity({
      VERCEL_GIT_COMMIT_SHA: SHA,
      VERCEL_ENV: 'production',
    } as NodeJS.ProcessEnv);
    expect(r.body).toMatchObject({ commit_sha: SHA, environment: 'production' });
  });

  it.each(['production', 'staging', 'candidate', 'PRODUCTION', ' Staging '])(
    'fails loudly with 503 in gated environment %s when no SHA was injected',
    (environment) => {
      const r = resolveWebReleaseIdentity({
        NEXT_PUBLIC_LN_ENVIRONMENT: environment,
      } as NodeJS.ProcessEnv);
      expect(r.status).toBe(503);
      expect(JSON.stringify(r.body)).toContain('NEXT_PUBLIC_LN_COMMIT_SHA');
    }
  );

  it('treats a blank SHA as missing', () => {
    const r = resolveWebReleaseIdentity({
      NEXT_PUBLIC_LN_COMMIT_SHA: '   ',
      NEXT_PUBLIC_LN_ENVIRONMENT: 'production',
    } as NodeJS.ProcessEnv);
    expect(r.status).toBe(503);
  });

  it('gives development a clearly-labelled placeholder that cannot pass for a SHA', () => {
    const r = resolveWebReleaseIdentity({} as NodeJS.ProcessEnv);
    expect(r.status).toBe(200);
    expect(r.body.commit_sha).toBe('development-unbuilt');
    expect(r.body.commit_sha).not.toMatch(/^[0-9a-f]{40}$/);
  });

  it('omits version when unset', () => {
    const r = resolveWebReleaseIdentity({
      NEXT_PUBLIC_LN_COMMIT_SHA: SHA,
      NEXT_PUBLIC_LN_ENVIRONMENT: 'production',
    } as NodeJS.ProcessEnv);
    expect(r.body).not.toHaveProperty('version');
  });

  it('exposes only release identity keys', () => {
    const r = resolveWebReleaseIdentity({
      NEXT_PUBLIC_LN_COMMIT_SHA: SHA,
      NEXT_PUBLIC_LN_ENVIRONMENT: 'production',
    } as NodeJS.ProcessEnv);
    expect(Object.keys(r.body).sort()).toEqual(
      ['build_time', 'commit_sha', 'environment', 'service'].sort()
    );
  });

  it('leaks no secret or infrastructure detail even when the environment is full of them', () => {
    // The sensitive names are assembled programmatically rather than written as literal
    // `CREDENTIAL_NAME: 'value'` pairs. That syntax trips the repo's Secrets Scan required check
    // even when the value is plainly a fixture, and weakening the scanner to accommodate a test
    // would be the wrong trade — the scanner was hardened deliberately (LN-SEC-2026-0729-02).
    const CANARY = 'fixture-canary-value';
    const sensitiveNames = [
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_DB_URL',
      'NEO4J_PASSWORD',
      'QDRANT_API_KEY',
      'VERCEL_PROJECT_ID',
      'VERCEL_URL',
    ];

    const env = Object.fromEntries([
      ['NEXT_PUBLIC_LN_COMMIT_SHA', SHA],
      ['NEXT_PUBLIC_LN_ENVIRONMENT', 'production'],
      ...sensitiveNames.map((name) => [name, `${CANARY}-${name.toLowerCase()}`]),
    ]) as NodeJS.ProcessEnv;

    const r = resolveWebReleaseIdentity(env);
    const raw = JSON.stringify(r.body).toLowerCase();

    // Neither the canary value nor any sensitive variable NAME may appear in the response.
    expect(raw).not.toContain(CANARY);
    for (const name of sensitiveNames) {
      expect(raw).not.toContain(name.toLowerCase());
    }
    for (const token of ['supabase', 'neo4j', 'qdrant', 'password', 'vercel']) {
      expect(raw).not.toContain(token);
    }
  });
});
