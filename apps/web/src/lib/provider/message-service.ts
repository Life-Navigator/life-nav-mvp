/**
 * Provider Messaging Service (Sprint J, Phase 7).
 *
 * Pure-logic validators + projector. Persistence and engagement
 * verification happen at the API route — the route calls
 * `providers.engagement_writable(engagement_id)` (migration 087) BEFORE
 * the INSERT so the rejection reason is specific instead of a generic
 * RLS denial.
 *
 * Contract:
 *   - Every outbound message is tied to an engagement.
 *   - Sender role must match the auth user identity.
 *   - Body is bounded (1–8000 chars).
 *   - Patient replies are allowed but cannot use provider-only kinds.
 */

import type { MessageKind, MessageSenderRole, ProviderMessage } from '@/types/provider-portal';

export interface ComposeMessageInput {
  engagement_id: string;
  provider_id: string;
  patient_user_id: string;
  sender_user_id: string;
  sender_role: MessageSenderRole;
  kind: MessageKind;
  subject?: string;
  body: string;
  related_recommendation_id?: string | null;
  related_lead_package_id?: string | null;
}

export interface MessageValidation {
  ok: boolean;
  errors: string[];
}

const PROVIDER_ONLY_KINDS: Set<MessageKind> = new Set([
  'follow_up_request',
  'review_request',
  'clarification_request',
]);

const PATIENT_ONLY_KINDS: Set<MessageKind> = new Set(['patient_reply']);

/**
 * Sanity checks before we hit the DB. Returns the explicit reason set
 * so the UI can render a clean message instead of a 500.
 */
export function validateCompose(input: ComposeMessageInput): MessageValidation {
  const errors: string[] = [];
  if (!input.engagement_id) errors.push('engagement_id required');
  if (!input.provider_id) errors.push('provider_id required');
  if (!input.patient_user_id) errors.push('patient_user_id required');
  if (!input.sender_user_id) errors.push('sender_user_id required');
  if (!['provider', 'patient', 'system'].includes(input.sender_role))
    errors.push('sender_role invalid');
  if (input.sender_role === 'provider' && PATIENT_ONLY_KINDS.has(input.kind)) {
    errors.push('provider cannot send patient_reply');
  }
  if (input.sender_role === 'patient' && PROVIDER_ONLY_KINDS.has(input.kind)) {
    errors.push('patient cannot send a provider-only message kind');
  }
  if (!input.body || input.body.trim().length === 0) errors.push('body empty');
  if (input.body && input.body.length > 8000) errors.push('body exceeds 8000 chars');
  if (input.subject && input.subject.length > 240) errors.push('subject too long');
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Thread projector — collapse a message list into chronological order
// + mark unread, deterministic
// ---------------------------------------------------------------------------

export interface ThreadProjection {
  total: number;
  unread_for_viewer: number;
  messages: ProviderMessage[];
}

export function projectThread(
  messages: ProviderMessage[],
  viewer_user_id: string
): ThreadProjection {
  const sorted = messages
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  let unread = 0;
  for (const m of sorted) {
    if (m.sender_user_id !== viewer_user_id && !m.read_at) unread++;
  }
  return {
    total: sorted.length,
    unread_for_viewer: unread,
    messages: sorted,
  };
}

export const __test = {
  validateCompose,
  projectThread,
  PROVIDER_ONLY_KINDS,
  PATIENT_ONLY_KINDS,
};
