/**
 * Shared advisor-chat client — the single source of truth for talking to the ongoing Advisor
 * (mode="advisor") from EVERY post-onboarding surface (dashboard Advisor + floating chat).
 *
 * Why this exists: the dashboard chat and the floating chat used to be two unrelated systems (one
 * hardcoded to discovery/onboarding mode, one a dead shell wired to a legacy agent backend). They now
 * share message types, the API client, and the copy so there is ONE advisor, never two AIs that
 * disagree. Discovery/onboarding mode is deliberately NOT reachable from here — that lives behind
 * /api/life/discovery-chat and is only used inside the onboarding flow.
 */

export interface AdvisorMessage {
  role: 'user' | 'advisor';
  text: string;
}

/** The advisor turn shape returned by core-api /v1/life/advisor/chat (only the fields a chat UI uses).
 *  `assistant_message` already contains inline citations — the validator strips ungrounded claims
 *  server-side, so the client just renders the approved text. */
export interface AdvisorTurn {
  assistant_message: string;
  llm_status?: string;
  complete?: boolean;
}

export const ADVISOR_CHAT_ENDPOINT = '/api/life/advisor/chat';

// Advisor-mode initial message (onboarding complete). General-purpose, grounded, NOT onboarding-specific
// and never tells a finished user to go complete setup.
export const ADVISOR_WELCOME =
  "I'm your LifeNavigator Advisor. Ask me about your goals, readiness, documents, scenarios, finances, career, education, family, or your next best action.";

// Shown when onboarding isn't finished yet: a clear STATE message, not a completed onboarding loop and
// never the "That's everything I need to start" onboarding line.
export const ADVISOR_INCOMPLETE_ONBOARDING =
  'Finish your setup so I can give you grounded advice. Once your profile is in place, I can help with goals, readiness, career, education, finances, and more.';

// Safe, non-alarming error fallback. Never silently routes to onboarding/discovery mode.
export const ADVISOR_ERROR =
  "I'm having trouble loading advisor mode right now. Your data is safe — please try again in a moment.";

/**
 * Send one advisor-mode turn. Resolves to the approved turn, or throws so callers render
 * ADVISOR_ERROR. `conversationId` threads cross-turn context server-side.
 */
export async function sendAdvisorMessage(
  message: string,
  conversationId: string,
  signal?: AbortSignal
): Promise<AdvisorTurn> {
  const res = await fetch(ADVISOR_CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversation_id: conversationId }),
    signal,
  });
  if (!res.ok) throw new Error(`advisor_chat_${res.status}`);
  const turn = (await res.json()) as AdvisorTurn;
  if (!turn || typeof turn.assistant_message !== 'string') {
    throw new Error('advisor_chat_bad_shape');
  }
  return turn;
}
