/**
 * Client-side env helpers — Sprint O.0 Phase 3.
 *
 * `requireEnv` from `lib/security/env.ts` is intended for server-side
 * code. Client components can't throw at module load because that
 * crashes the page. This helper returns a typed result that the
 * component decides how to render.
 *
 * Pattern:
 *
 *   const api = clientEnvUrl('NEXT_PUBLIC_API_URL');
 *   if (!api.ok) return <ServiceUnavailable kind={api.kind} />;
 *   const url = api.value;
 *
 * In development the loopback fallback is preserved because the dev
 * stack commonly runs locally. In production, missing/loopback values
 * are reported via `ok: false` so the UI renders a graceful notice.
 */

const PROD = process.env.NODE_ENV === 'production';

export type ClientEnvResult =
  | { ok: true; value: string }
  | { ok: false; kind: 'missing' | 'loopback'; name: string };

function isLoopback(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
}

export function clientEnvUrl(name: string, devFallback?: string): ClientEnvResult {
  const raw = process.env[name];
  const value = raw && raw.length > 0 ? raw : !PROD ? devFallback : undefined;
  if (!value) return { ok: false, kind: 'missing', name };
  try {
    const u = new URL(value);
    if (PROD && isLoopback(u.hostname)) {
      return { ok: false, kind: 'loopback', name };
    }
  } catch {
    return { ok: false, kind: 'missing', name };
  }
  return { ok: true, value };
}

export const __test = { isLoopback };
