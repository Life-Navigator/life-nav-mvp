/**
 * Arcana conversational-streaming policy.
 *
 * UX requirement: Arcana must feel alive and conversational. The COMPLIANCE GATE IS
 * UNCHANGED — the server still generates the full response, runs validation/compliance,
 * and releases ONLY the approved final text. This module governs the *client-side*
 * presentation of that already-approved text:
 *
 *   - the subtle "thinking / checking" status before approval (no model output shown),
 *   - the fast, locally-simulated typing of the approved answer,
 *   - the immediate (non-typed) rendering of safety responses,
 *   - a feature flag to disable the effect entirely.
 *
 * We never stream unapproved model tokens. The only thing the client animates is the
 * `final` event's validated text. The deterministic `ack` event drives a status label,
 * not a visible answer.
 */

const truthyOff = (v: string | undefined) =>
  v != null && ['false', '0', 'off', 'no'].includes(v.trim().toLowerCase());

/** Master switch. Streaming is ON by default; set NEXT_PUBLIC_ARCANA_STREAMING=false to disable. */
export const ARCANA_STREAMING_ENABLED = !truthyOff(process.env.NEXT_PUBLIC_ARCANA_STREAMING);

/** Admin/debug only: surface llm_status / pipeline metadata. Never on for normal users. */
export const ARCANA_DEBUG =
  (process.env.NEXT_PUBLIC_ARCANA_DEBUG ?? '').trim().toLowerCase() === 'true';

/** The conversational lifecycle the UI can be in. */
export type ArcanaStatus =
  | 'idle'
  | 'thinking' // user sent; model generating (nothing user-visible but status)
  | 'checking' // deterministic ack arrived; compliance/validation running
  | 'responding' // approved text is typing out
  | 'approved' // finished typing the approved answer
  | 'fallback' // approved deterministic fallback was returned
  | 'safety_response' // safety reply — render immediately, never typed
  | 'error'; // human-friendly failure

/** Subtle status copy. Kept deliberately understated — "not a 1998 chatbot." */
export const ARCANA_STATUS_LABEL: Partial<Record<ArcanaStatus, string>> = {
  thinking: 'Arcana is thinking',
  checking: 'Arcana is checking this',
  responding: 'Arcana is responding',
};

export const ARCANA_ERROR_MESSAGE =
  "Arcana couldn't complete that just now. Please try again in a moment.";

/**
 * Map the server's llm_status (the only pipeline signal the client sees) to a UX state.
 * NOTE: this classifies an ALREADY-APPROVED final response — it never gates content.
 *   - "safety_fallback"  → safety_response (render immediately)
 *   - "fallback:*"        → fallback (approved deterministic answer)
 *   - everything else     → responding (normal typed reveal)
 */
export function statusForFinal(llmStatus?: string | null): ArcanaStatus {
  const s = (llmStatus ?? '').toLowerCase();
  if (s === 'safety_fallback') return 'safety_response';
  if (s.startsWith('fallback')) return 'fallback';
  return 'responding';
}

/** A safety response must render instantly (acceptance criterion 4); so must a flag-off render. */
export function shouldRenderInstantly(status: ArcanaStatus): boolean {
  return !ARCANA_STREAMING_ENABLED || status === 'safety_response';
}

/**
 * Total typing duration for the approved answer, by length. Fast and natural, never theatrical:
 *   - short  (≤120 chars): ~300–500ms
 *   - medium (≤600 chars): ~1–2s
 *   - long   (>600 chars): ~2–5s (clamped)
 */
export function streamDurationMs(len: number): number {
  if (len <= 120) return 300 + Math.round((len / 120) * 200); // 300–500ms
  if (len <= 600) return 1000 + Math.round(((len - 120) / 480) * 1000); // 1000–2000ms
  const extra = Math.min(len - 600, 1400); // cap the long-tail contribution
  return Math.min(5000, 2000 + Math.round((extra / 1400) * 3000)); // 2000–5000ms
}
