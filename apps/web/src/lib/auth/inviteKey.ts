import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

// Private invite-key gate. An invite key is an email-BOUND HMAC that only the holder of INVITE_SIGNING_SECRET
// (the founder) can mint. Account creation is allowed ONLY when a valid key for that exact email is presented.
// Email-bound means a leaked key works for nobody but the intended tester. Stateless → no table/migration; an
// account can only be redeemed once because the second attempt fails ("user already registered").
//
// REQUIRED for this to be airtight: public signup must be DISABLED in Supabase (Auth settings), so the
// service-role redeem route is the only path that can create a user — otherwise GoTrue's /signup is reachable
// directly with the public anon key and bypasses this gate. See docs/beta/PRIVATE_SIGNUP_GATE.md.

function secret(): string {
  const s = process.env.INVITE_SIGNING_SECRET;
  if (!s || s.length < 16) {
    throw new Error('INVITE_SIGNING_SECRET is not set (or too short) — invite gate cannot operate');
  }
  return s;
}

const norm = (email: string): string => (email || '').trim().toLowerCase();

/** Mint the invite key for an email (founder-side, via the mint script). base64url HMAC-SHA256(email). */
export function inviteKeyFor(email: string): string {
  return createHmac('sha256', secret())
    .update(`invite:v1:${norm(email)}`)
    .digest('base64url');
}

/** Constant-time verify that `key` is the valid invite key for `email`. */
export function verifyInviteKey(email: string, key: string | null | undefined): boolean {
  const e = norm(email);
  const provided = String(key || '');
  if (!e || !provided) return false;
  let expected: string;
  try {
    expected = inviteKeyFor(e);
  } catch {
    return false; // misconfigured secret → fail closed
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Whether the gate is configured (secret present). When false, the redeem route must fail closed. */
export function inviteGateConfigured(): boolean {
  const s = process.env.INVITE_SIGNING_SECRET;
  return !!s && s.length >= 16;
}
