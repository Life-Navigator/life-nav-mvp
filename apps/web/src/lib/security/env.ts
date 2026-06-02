/**
 * Environment helpers — Sprint N.2 Phase 6 security hardening.
 *
 * The previous pattern was:
 *
 *   const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
 *
 * That fallback is dangerous in production:
 *
 *   1. If the env var is unset, the route silently SSRFs to localhost
 *      on the Vercel runtime. The bug surfaces as a timeout, not as a
 *      config error.
 *   2. There is no operator signal that the integration is misconfigured.
 *   3. The "fallback" is identical to the developer's machine, so dev
 *      shadowing reaches into production unintentionally.
 *
 * `requireEnv` fails loudly in production. In NODE_ENV !== 'production'
 * a dev default may be provided; passing no default means the call
 * throws even in dev.
 */

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

export class MissingEnvError extends Error {
  constructor(name: string) {
    super(`Required environment variable "${name}" is not set`);
    this.name = 'MissingEnvError';
  }
}

export function requireEnv(name: string, devDefault?: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (!isProd() && devDefault !== undefined) return devDefault;
  throw new MissingEnvError(name);
}

/**
 * Same as requireEnv but additionally checks the value parses as a URL
 * and that in production it is NOT a loopback / private network.
 */
export function requireEnvUrl(name: string, devDefault?: string): string {
  const raw = requireEnv(name, devDefault);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new MissingEnvError(`${name}_invalid_url`);
  }
  if (isProd() && isLoopback(u.hostname)) {
    throw new MissingEnvError(`${name}_loopback_in_production`);
  }
  return raw;
}

function isLoopback(host: string): boolean {
  if (!host) return true;
  if (host === 'localhost') return true;
  if (host === '127.0.0.1') return true;
  if (host === '0.0.0.0') return true;
  if (host === '::1') return true;
  return false;
}

export const __test = { isLoopback };
