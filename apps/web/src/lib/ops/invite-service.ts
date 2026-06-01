/**
 * Invite Service — Sprint M Phase 6.
 *
 * Pure-logic + DB-bound helpers for the closed-beta invite flow.
 *
 *   - createInvite(email, cohort, invited_by) → invite row (service role)
 *   - lookupInvite(code) → invite row or null
 *   - redeemInvite(code, user_id) → marks invite as accepted + joins cohort
 *   - revokeInvite(code, reason)
 *
 * `evaluateInvite` is the pure status check used by the redemption
 * endpoint to fail with structured reasons before the DB write.
 */

export type InviteStatus = 'pending' | 'sent' | 'accepted' | 'expired' | 'revoked';

export interface InviteRow {
  id: string;
  email: string;
  invite_code: string;
  cohort_slug: string;
  invited_at: string;
  sent_at?: string | null;
  accepted_at?: string | null;
  accepted_by?: string | null;
  expires_at: string;
  revoked_at?: string | null;
  status: InviteStatus;
}

export interface InviteVerdict {
  ok: boolean;
  reasons: string[];
}

export function evaluateInvite(invite: InviteRow | null, now: string): InviteVerdict {
  if (!invite) return { ok: false, reasons: ['invite_not_found'] };
  const reasons: string[] = [];
  if (invite.status === 'revoked' || invite.revoked_at) reasons.push('invite_revoked');
  if (invite.expires_at && invite.expires_at < now) reasons.push('invite_expired');
  if (invite.status === 'accepted' && invite.accepted_by) reasons.push('invite_already_accepted');
  return { ok: reasons.length === 0, reasons };
}

export function generateInviteCode(rand: () => number = Math.random): string {
  const alpha = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // ambiguous chars dropped
  let s = '';
  for (let i = 0; i < 12; i++) {
    s += alpha[Math.floor(rand() * alpha.length)];
  }
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

export const __test = { evaluateInvite, generateInviteCode };
