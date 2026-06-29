// Canonical PRIVATE-BETA access gate (server-side). One source of truth for "may this email use the app".
// Env-driven (table-backed allowlist optional later). NEVER logs allowlist contents or tokens.
//
//   PRIVATE_BETA_ENABLED        = true|1|yes|on   → gate is ON (default OFF = normal behavior)
//   PRIVATE_BETA_ADMIN_EMAILS   = comma list of founder/admin emails (always allowed when gate ON)
//   PRIVATE_BETA_ALLOWED_EMAILS = comma list of approved tester emails
// The controlled synthetic-beta domain (@lifenav-beta.example.com) is allowed by default so the five gate
// accounts work without per-email config; real testers must be listed explicitly.

const SYNTHETIC_BETA_DOMAIN = '@lifenav-beta.example.com';

const truthy = (v: string | undefined): boolean => /^(1|true|yes|on)$/i.test((v || '').trim());

const emailList = (name: string): Set<string> =>
  new Set(
    (process.env[name] || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

/** Is the private-beta gate active? When false, the app behaves normally (open). */
export function privateBetaEnabled(): boolean {
  return truthy(process.env.PRIVATE_BETA_ENABLED);
}

/** May this email access the app? Gate OFF → always true. Gate ON → admin OR allowlisted OR synthetic domain. */
export function isBetaAccessAllowed(email: string | null | undefined): boolean {
  if (!privateBetaEnabled()) return true; // gate off → normal
  const e = (email || '').trim().toLowerCase();
  if (!e) return false; // missing email → block (never initialize)
  if (emailList('PRIVATE_BETA_ADMIN_EMAILS').has(e)) return true;
  if (emailList('PRIVATE_BETA_ALLOWED_EMAILS').has(e)) return true;
  if (e.endsWith(SYNTHETIC_BETA_DOMAIN)) return true; // controlled synthetic beta accounts
  return false;
}

/** Safe, non-PII audit detail for a blocked attempt (masked email + reason). Never includes tokens. */
export function blockedReason(email: string | null | undefined): {
  masked: string;
  reason: string;
} {
  const e = (email || '').trim().toLowerCase();
  if (!e) return { masked: '(none)', reason: 'missing_email' };
  const [local, domain] = e.split('@');
  const masked = `${local.slice(0, 2)}***@${domain || ''}`;
  return { masked, reason: 'not_allowlisted' };
}
